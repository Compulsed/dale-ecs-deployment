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
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";

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

    const taskDefinition = new FargateTaskDefinition(this, "TaskDef", {
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.ARM64,
      },
    });

    taskDefinition.addContainer("web", {
      image: ContainerImage.fromRegistry(
        "dalesalter/dale-ecs-deployment-api:latest"
      ),
      memoryLimitMiB: 512,
      cpu: 256,
      command: ["npm", "start"],
      portMappings: [
        {
          containerPort: 80,
          hostPort: 80,
        },
      ],
      logging: LogDriver.awsLogs({ streamPrefix: "web" }),
    });

    const service = new FargateService(this, "FargateService", {
      cluster,
      taskDefinition,
      // Consider if this is required because we update via CFN
      taskDefinitionRevision: TaskDefinitionRevision.LATEST,
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
      securityGroups: [],
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
