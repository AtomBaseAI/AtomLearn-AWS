import type { ServiceIconId } from "@/components/aws-icons";

export interface ServiceStat {
  label: string;
  value: string;
}

export interface ServiceDoc {
  /** full official documentation name (aria-label) */
  title: string;
  /** compact bracket label shown on the link button */
  label: string;
  url: string;
}

export interface ServiceMeta {
  id: string;
  index: string;
  name: string;
  short: string;
  /** official AWS service abbreviation (e.g. IAM, S3, APIGW, CFN) */
  abbr: string;
  category:
    | "GLOBAL"
    | "SECURITY"
    | "STORAGE"
    | "NETWORK"
    | "COMPUTE"
    | "TRAFFIC"
    | "APP-NET"
    | "EDGE"
    | "DATA"
    | "OPS";
  tagline: string;
  description: string;
  iconId: ServiceIconId;
  stats: ServiceStat[];
  docs?: ServiceDoc[];
}

export const SERVICES: ServiceMeta[] = [
  {
    id: "global-infrastructure",
    index: "01",
    name: "GLOBAL INFRASTRUCTURE",
    short: "GLOBAL",
    abbr: "GI",
    category: "GLOBAL",
    tagline: "Regions. Availability Zones. Edge PoPs.",
    description:
      "AWS spans 30+ geographic Regions, each a cluster of isolated Availability Zones, plus hundreds of Points of Presence for CloudFront. Explore the planet-scale network in 3D.",
    iconId: "global-infrastructure",
    docs: [
      {
        title: "AWS Global Infrastructure",
        label: "AWS Global Infrastructure",
        url: "https://aws.amazon.com/about-aws/global-infrastructure/",
      },
    ],
    stats: [
      { label: "REGIONS", value: "34" },
      { label: "AZs", value: "108" },
      { label: "EDGE PoPs", value: "600+" },
      { label: "COUNTRIES", value: "245" },
    ],
  },
  {
    id: "iam",
    index: "02",
    name: "IDENTITY & ACCESS MANAGEMENT",
    short: "IAM",
    abbr: "IAM",
    category: "SECURITY",
    tagline: "Who can do what, on which resource.",
    description:
      "IAM is the zero-trust control plane: users, groups, roles and policies evaluated against an explicit-deny-first engine. Step through a live policy evaluation simulation.",
    iconId: "iam",
    docs: [
      {
        title: "AWS Identity and Access Management Documentation",
        label: "AWS IAM Documentation",
        url: "https://docs.aws.amazon.com/iam/",
      },
    ],
    stats: [
      { label: "ENTITIES", value: "5 TYPES" },
      { label: "EVAL ORDER", value: "DENY>ALLOW" },
      { label: "DEFAULT", value: "DENY ALL" },
      { label: "MFA", value: "REQUIRED" },
    ],
  },
  {
    id: "s3",
    index: "03",
    name: "SIMPLE STORAGE SERVICE",
    short: "S3",
    abbr: "S3",
    category: "STORAGE",
    tagline: "11 nines of durability. Object storage at planet scale.",
    description:
      "Buckets hold objects replicated across ≥3 AZs. Watch the storage-class lifecycle, cross-region replication and versioning in action.",
    iconId: "s3",
    docs: [
      {
        title: "Amazon Simple Storage Service Documentation",
        label: "AWS S3 Documentation",
        url: "https://docs.aws.amazon.com/s3/",
      },
    ],
    stats: [
      { label: "DURABILITY", value: "99.999999999%" },
      { label: "AVAILABILITY", value: "99.99%" },
      { label: "CLASSES", value: "7" },
      { label: "OBJECTS", value: "UNLIMITED" },
    ],
  },
  {
    id: "vpc",
    index: "04",
    name: "VIRTUAL PRIVATE CLOUD",
    short: "VPC",
    abbr: "VPC",
    category: "NETWORK",
    tagline: "Your private software-defined network.",
    description:
      "Subnets across AZs, internet gateways, NAT, route tables, security groups and NACLs — trace a packet from the internet to a private instance.",
    iconId: "vpc",
    docs: [
      {
        title: "Amazon Virtual Private Cloud Documentation",
        label: "AWS VPC Documentation",
        url: "https://docs.aws.amazon.com/vpc/",
      },
    ],
    stats: [
      { label: "CIDR", value: "/16 MAX" },
      { label: "SUBNETS/AZ", value: "200" },
      { label: "SG RULES", value: "STATEFUL" },
      { label: "NACL", value: "STATELESS" },
    ],
  },
  {
    id: "ec2",
    index: "05",
    name: "ELASTIC COMPUTE CLOUD",
    short: "EC2",
    abbr: "EC2",
    category: "COMPUTE",
    tagline: "Resizable virtual machines in minutes.",
    description:
      "750+ instance families across 8 shapes. Trigger the lifecycle state machine, resize instances and watch Auto Scaling react to load.",
    iconId: "ec2",
    docs: [
      {
        title: "Amazon Elastic Compute Cloud Documentation",
        label: "AWS EC2 Documentation",
        url: "https://docs.aws.amazon.com/ec2/",
      },
    ],
    stats: [
      { label: "FAMILIES", value: "8 SHAPES" },
      { label: "TYPES", value: "750+" },
      { label: "BOOT TIME", value: "~60 SEC" },
      { label: "PRICING", value: "4 MODELS" },
    ],
  },
  {
    id: "elb",
    index: "06",
    name: "ELASTIC LOAD BALANCING",
    short: "ELB",
    abbr: "ELB",
    category: "TRAFFIC",
    tagline: "Single DNS name. Infinite backends.",
    description:
      "ALB routes at Layer 7, NLB at Layer 4 with static IPs. Fire requests at a target group and watch round-robin distribution plus health-check failover.",
    iconId: "elb",
    docs: [
      {
        title: "Elastic Load Balancing Documentation",
        label: "AWS ELB Documentation",
        url: "https://docs.aws.amazon.com/elasticloadbalancing/",
      },
    ],
    stats: [
      { label: "LAYERS", value: "L4 / L7" },
      { label: "ALGORITHMS", value: "RR+LC" },
      { label: "HEALTH CHK", value: "AUTO" },
      { label: "TLS TERM", value: "BUILT-IN" },
    ],
  },
  {
    id: "lambda",
    index: "07",
    name: "AWS LAMBDA",
    short: "λ LAMBDA",
    abbr: "LMD",
    category: "COMPUTE",
    tagline: "Zero servers. Pure events.",
    description:
      "Upload code, attach triggers, pay per millisecond. Invoke a function live, compare cold vs warm starts and watch concurrency scale to zero.",
    iconId: "lambda",
    docs: [
      {
        title: "AWS Lambda Documentation",
        label: "AWS Lambda Documentation",
        url: "https://docs.aws.amazon.com/lambda/",
      },
    ],
    stats: [
      { label: "TIMEOUT", value: "15 MIN" },
      { label: "MEMORY", value: "128M–10G" },
      { label: "COLD START", value: "~100 MS" },
      { label: "SCALE", value: "1K/10S" },
    ],
  },
  {
    id: "api-gateway",
    index: "08",
    name: "API GATEWAY",
    short: "API GW",
    abbr: "APIGW",
    category: "APP-NET",
    tagline: "The front door for your APIs.",
    description:
      "Throttling, authorization, request validation, transformation — follow a request through every stage of the API Gateway lifecycle.",
    iconId: "api-gateway",
    docs: [
      {
        title: "Amazon API Gateway Documentation",
        label: "AWS API Gateway Documentation",
        url: "https://docs.aws.amazon.com/apigateway/",
      },
    ],
    stats: [
      { label: "TYPES", value: "REST/HTTP/WS" },
      { label: "THROTTLE", value: "10K RPS" },
      { label: "AUTH", value: "IAM/COGNITO" },
      { label: "CACHING", value: "TTL 0–3600" },
    ],
  },
  {
    id: "sns",
    index: "09",
    name: "SIMPLE NOTIFICATION SERVICE",
    short: "SNS",
    abbr: "SNS",
    category: "APP-NET",
    tagline: "Publish once. Fan out everywhere.",
    description:
      "Topics deliver to SQS, Lambda, HTTP, email and mobile push. Fire a message and watch the fan-out storm hit every subscriber.",
    iconId: "sns",
    docs: [
      {
        title: "Amazon Simple Notification Service Documentation",
        label: "AWS SNS Documentation",
        url: "https://docs.aws.amazon.com/sns/",
      },
    ],
    stats: [
      { label: "SUBS/TOPIC", value: "12.5M+" },
      { label: "THROUGHPUT", value: "UNLIMITED" },
      { label: "PATTERNS", value: "PUB/SUB" },
      { label: "FIFO", value: "SUPPORTED" },
    ],
  },
  {
    id: "sqs",
    index: "10",
    name: "SIMPLE QUEUE SERVICE",
    short: "SQS",
    abbr: "SQS",
    category: "APP-NET",
    tagline: "Decouple everything. Lose nothing.",
    description:
      "Managed message queues with visibility timeouts, dead-letter queues and near-unlimited throughput. Push messages and drain the queue with consumers.",
    iconId: "sqs",
    docs: [
      {
        title: "Amazon Simple Queue Service Documentation",
        label: "AWS SQS Documentation",
        url: "https://docs.aws.amazon.com/sqs/",
      },
    ],
    stats: [
      { label: "SCALE", value: "UNLIMITED" },
      { label: "RETRIES", value: "AUTOMATIC" },
      { label: "RETENTION", value: "14 DAYS" },
      { label: "DLQ", value: "BUILT-IN" },
    ],
  },
  {
    id: "cloudfront",
    index: "11",
    name: "CLOUDFRONT CDN",
    short: "CDN",
    abbr: "CF",
    category: "EDGE",
    tagline: "Content cached at the edge of the world.",
    description:
      "600+ edge locations cache your origin. Race a cache MISS against a cache HIT and see why latency drops from hundreds of ms to single digits.",
    iconId: "cloudfront",
    docs: [
      {
        title: "Amazon CloudFront Documentation",
        label: "AWS CloudFront Documentation",
        url: "https://docs.aws.amazon.com/cloudfront/",
      },
    ],
    stats: [
      { label: "EDGE LOC", value: "600+" },
      { label: "CACHE HIT", value: "~10 MS" },
      { label: "ORIGIN", value: "S3/ALB" },
      { label: "PROTOCOLS", value: "HTTP/3" },
    ],
  },
  {
    id: "rds",
    index: "12",
    name: "RELATIONAL DATABASE SERVICE",
    short: "RDS",
    abbr: "RDS",
    category: "DATA",
    tagline: "Managed SQL. Multi-AZ. Zero patching.",
    description:
      "Managed PostgreSQL, MySQL, MariaDB, Oracle and SQL Server with Aurora. Watch synchronous Multi-AZ replication, async read-replica lag, automatic failover and RDS Proxy connection pooling — live.",
    iconId: "rds",
    docs: [
      {
        title: "Amazon RDS and Aurora Documentation",
        label: "AWS RDS Documentation",
        url: "https://docs.aws.amazon.com/rds/",
      },
    ],
    stats: [
      { label: "ENGINES", value: "7+" },
      { label: "MULTI-AZ", value: "SYNC" },
      { label: "REPLICAS", value: "UP TO 15" },
      { label: "FAILOVER", value: "60–120S" },
    ],
  },
  {
    id: "cloudwatch",
    index: "13",
    name: "AMAZON CLOUDWATCH",
    short: "CW",
    abbr: "CW",
    category: "OPS",
    tagline: "Metrics, alarms, actions. Total observability.",
    description:
      "Every service streams metrics to CloudWatch. Threshold alarms evaluate datapoints, fire SNS notifications and trigger Auto Scaling actions — follow the full signal path from metric to remediation.",
    iconId: "cloudwatch",
    docs: [
      {
        title: "Amazon CloudWatch Documentation",
        label: "AWS CloudWatch Documentation",
        url: "https://docs.aws.amazon.com/cloudwatch/",
      },
    ],
    stats: [
      { label: "RESOLUTION", value: "1 SEC" },
      { label: "RETENTION", value: "15 MO" },
      { label: "EVALUATION", value: "N/ M PTS" },
      { label: "ACTIONS", value: "SNS+ASG" },
    ],
  },
  {
    id: "containers",
    index: "14",
    name: "CONTAINERS — ECS · EKS · ECR",
    short: "CONTAINERS",
    abbr: "ECS·EKS",
    category: "COMPUTE",
    tagline: "Ship containers, not servers. ECS, EKS, ECR.",
    description:
      "ECS schedules tasks from ECR images across EC2 or Fargate capacity; EKS runs upstream Kubernetes. Deploy a new image live, autoscale on CPU and watch tasks drain and replace with zero downtime.",
    iconId: "containers",
    docs: [
      {
        title: "Amazon Elastic Container Service Documentation",
        label: "AWS ECS Documentation",
        url: "https://docs.aws.amazon.com/ecs/",
      },
      {
        title: "Amazon Elastic Container Registry Documentation",
        label: "AWS ECR Documentation",
        url: "https://docs.aws.amazon.com/ecr/",
      },
      {
        title: "Amazon Elastic Kubernetes Service Documentation",
        label: "AWS EKS Documentation",
        url: "https://docs.aws.amazon.com/eks/",
      },
    ],
    stats: [
      { label: "LAUNCH TYPE", value: "EC2/FARGATE" },
      { label: "ORCHESTRATOR", value: "ECS + EKS" },
      { label: "REGISTRY", value: "ECR" },
      { label: "DEPLOY", value: "ROLLING" },
    ],
  },
  {
    id: "cloudformation",
    index: "15",
    name: "AWS CLOUDFORMATION",
    short: "CFN",
    abbr: "CFN",
    category: "OPS",
    tagline: "Infrastructure as code. Declare it once. Deploy it everywhere.",
    description:
      "CloudFormation turns YAML/JSON templates into provisioned stacks — resolving dependency order, creating resources in parallel waves, detecting drift and rolling back failed deployments automatically. Deploy a stack live: create, update, rollback, drift-detect and roll out to every account with StackSets.",
    iconId: "cloudformation",
    docs: [
      {
        title: "AWS CloudFormation Documentation",
        label: "AWS CloudFormation Documentation",
        url: "https://docs.aws.amazon.com/cloudformation/",
      },
    ],
    stats: [
      { label: "TEMPLATE", value: "YAML/JSON" },
      { label: "RESOURCE TYPES", value: "1500+" },
      { label: "ROLLBACK", value: "AUTOMATIC" },
      { label: "STACKSETS", value: "MULTI-ACCT" },
    ],
  },
];

export const SERVICE_MAP: Record<string, ServiceMeta> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s])
);

/**
 * URL deep-link aliases for ?service=<key> — every entry resolves to a
 * SERVICES id. Matching is done on a normalized key (lowercase, spaces /
 * dashes / underscores / dots stripped), so "API Gateway", "api-gateway",
 * "apigw" and "APIGW" all land on the API Gateway module.
 */
const SERVICE_ALIASES: Record<string, string> = {
  // global infrastructure
  gi: "global-infrastructure",
  infra: "global-infrastructure",
  globalinfra: "global-infrastructure",
  globalinfrastructure: "global-infrastructure",
  // identity
  identity: "iam",
  accessmanagement: "iam",
  // lambda
  lmd: "lambda",
  fn: "lambda",
  // api gateway
  apigw: "api-gateway",
  apigateway: "api-gateway",
  gateway: "api-gateway",
  // cloudfront
  cdn: "cloudfront",
  // cloudwatch
  cloudwatchlogs: "cloudwatch",
  monitoring: "cloudwatch",
  // containers
  ecs: "containers",
  eks: "containers",
  ecr: "containers",
  k8s: "containers",
  kubernetes: "containers",
  docker: "containers",
  // cloudformation
  cfn: "cloudformation",
  iaac: "cloudformation",
  iac: "cloudformation",
  stack: "cloudformation",
  stacks: "cloudformation",
};

/** normalize a raw ?service= value: lowercase + strip separators */
const normKey = (v: string) => v.toLowerCase().replace(/[\s_\-.]/g, "");

/**
 * Resolve a raw URL ?service= value to a SERVICES id (or null if unknown).
 * Match order: exact id → normalized id → short / abbr / name → alias map.
 */
export function resolveServiceKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const raw2 = normKey(raw);
  // exact + normalized id
  if (SERVICE_MAP[raw]) return raw;
  const byId = SERVICES.find((s) => normKey(s.id) === raw2);
  if (byId) return byId.id;
  // short display name, official abbreviation, full name
  const byMeta = SERVICES.find(
    (s) => normKey(s.short) === raw2 || normKey(s.abbr) === raw2 || normKey(s.name) === raw2
  );
  if (byMeta) return byMeta.id;
  // curated alias table
  return SERVICE_ALIASES[raw2] ?? null;
}

/** truthy values accepted for ?mapperhidden= */
export function parseBoolParam(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const v = raw.toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}
