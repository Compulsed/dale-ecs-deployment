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
} from "aws-cdk-lib/aws-ecs";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import {
  PredefinedMetric,
  ScalableTarget,
  ServiceNamespace,
  TargetTrackingScalingPolicy,
} from "aws-cdk-lib/aws-applicationautoscaling";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

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

    // Allow SSM to SSH into the running container
    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
        ],
      })
    );

    const image = this.node.tryGetContext("image");

    taskDefinition.addContainer("web-new", {
      // image: ContainerImage.fromRegistry(
      //   "dalesalter/dale-ecs-deployment-api:latest"
      // ),
      image: ContainerImage.fromEcrRepository(
        Repository.fromRepositoryName(this, "repo", "dale-ecs-deployment-repo"),
        image
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
      // taskDefinitionRevision: TaskDefinitionRevision.LATEST,
      // Consider if this is required because we update via CFN
      taskDefinition,
      // Might be required or else we cannot connect out publically (without a nat gateway) -- this might be required
      //  for dockerhub images?
      assignPublicIp: true,
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
      enableExecuteCommand: true,
    });

    const scalableTarget = new ScalableTarget(this, "ScalableTarget", {
      serviceNamespace: ServiceNamespace.ECS,
      resourceId: `service/${cluster.clusterName}/${service.serviceName}`,
      scalableDimension: "ecs:service:DesiredCount",
      minCapacity: 1,
      maxCapacity: 10,
    });

    new TargetTrackingScalingPolicy(this, "ScalingPolicy", {
      policyName: "CPUUtilizationScalingPolicy",
      targetValue: 20,
      scaleOutCooldown: cdk.Duration.seconds(60),
      scaleInCooldown: cdk.Duration.seconds(60),
      predefinedMetric: PredefinedMetric.ECS_SERVICE_AVERAGE_CPU_UTILIZATION,
      scalingTarget: scalableTarget,
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
