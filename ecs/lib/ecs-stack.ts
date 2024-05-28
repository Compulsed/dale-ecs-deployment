import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  OperatingSystemFamily,
  TaskDefinitionRevision,
} from "aws-cdk-lib/aws-ecs";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Repository } from "aws-cdk-lib/aws-ecr";

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, "DefaultVpc", {
      isDefault: true,
    });

    const cluster = new Cluster(this, "FargateCPCluster", {
      vpc,
      enableFargateCapacityProviders: true,
    });

    const taskDefinition = new FargateTaskDefinition(this, "WebTask", {
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.X86_64,
      },
    });

    // TODO: Inject container id from build hash
    taskDefinition.addContainer("web-new", {
      // image: ContainerImage.fromRegistry(
      //   "dalesalter/dale-ecs-deployment-api:latest"
      // ),
      image: ContainerImage.fromEcrRepository(
        Repository.fromRepositoryName(this, "repo", "dale-ecs-deployment-repo"),
        "latest"
      ),
      memoryLimitMiB: 512,
      cpu: 256,
      // Overrides the default 'dev' mode
      command: ["npm", "start"],
      portMappings: [
        {
          containerPort: 80,
          hostPort: 80,
        },
      ],
      logging: LogDriver.awsLogs({ streamPrefix: "web" }),
    });

    // Useful to inspect the individual tasks
    const httpFromAnyWheresecurityGroup = new SecurityGroup(
      this,
      "all-http-sg",
      {
        vpc,
      }
    );

    httpFromAnyWheresecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      "Http from anywhere"
    );

    const service = new FargateService(this, "FargateService", {
      cluster,
      taskDefinition,
      // Consider if this is required because we update via CFN
      // taskDefinitionRevision: TaskDefinitionRevision.LATEST,
      // Might be required or else we cannot connect out publically (without a nat gateway) -- this might be required
      //  for dockerhub images?
      assignPublicIp: true,
      // TODO: How does this impact auto-scaling? -- do we need to do this separately?
      //  -- https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs-readme.html#task-auto-scaling
      desiredCount: 3,
      capacityProviderStrategies: [
        {
          capacityProvider: "FARGATE",
          weight: 1,
        },
      ],
      circuitBreaker: {
        enable: true,
        rollback: true,
      },
      securityGroups: [httpFromAnyWheresecurityGroup],
    });

    const lb = new ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
    });

    const listener = lb.addListener("Listener", { port: 80 });

    listener.addTargets("ECS1", {
      port: 80,
      targets: [service],
    });
  }
}
