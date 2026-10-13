import type { ServiceIconId } from "@/components/aws-icons";

export interface ServiceStat {
  label: string;
  value: string;
}

export interface ServiceMeta {
  id: string;
  index: string;
  name: string;
  short: string;
  codename: string;
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
}

export const SERVICES: ServiceMeta[] = [
  {
    id: "global-infrastructure",
    index: "01",
    name: "GLOBAL INFRASTRUCTURE",
    short: "GLOBAL",
    codename: "ORBITAL GRID",
    category: "GLOBAL",
    tagline: "Regions. Availability Zones. Edge PoPs.",
    description:
      "AWS spans 30+ geographic Regions, each a cluster of isolated Availability Zones, plus hundreds of Points of Presence for CloudFront. Explore the planet-scale network in 3D.",
    iconId: "global-infrastructure",
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
    name: "IDENTITY & ACCESS MGMT",
    short: "IAM",
    codename: "ACCESS MATRIX",
    category: "SECURITY",
    tagline: "Who can do what, on which resource.",
    description:
      "IAM is the zero-trust control plane: users, groups, roles and policies evaluated against an explicit-deny-first engine. Step through a live policy evaluation simulation.",
    iconId: "iam",
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
    codename: "INFINITE VAULT",
    category: "STORAGE",
    tagline: "11 nines of durability. Object storage at planet scale.",
    description:
      "Buckets hold objects replicated across ≥3 AZs. Watch the storage-class lifecycle, cross-region replication and versioning in action.",
    iconId: "s3",
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
    codename: "VOID NETWORK",
    category: "NETWORK",
    tagline: "Your private software-defined network.",
    description:
      "Subnets across AZs, internet gateways, NAT, route tables, security groups and NACLs — trace a packet from the internet to a private instance.",
    iconId: "vpc",
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
    codename: "CORE FORGE",
    category: "COMPUTE",
    tagline: "Resizable virtual machines in minutes.",
    description:
      "750+ instance families across 8 shapes. Trigger the lifecycle state machine, resize instances and watch Auto Scaling react to load.",
    iconId: "ec2",
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
    codename: "TRAFFIC SPLITTER",
    category: "TRAFFIC",
    tagline: "Single DNS name. Infinite backends.",
    description:
      "ALB routes at Layer 7, NLB at Layer 4 with static IPs. Fire requests at a target group and watch round-robin distribution plus health-check failover.",
    iconId: "elb",
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
    codename: "PHANTOM COMPUTE",
    category: "COMPUTE",
    tagline: "Zero servers. Pure events.",
    description:
      "Upload code, attach triggers, pay per millisecond. Invoke a function live, compare cold vs warm starts and watch concurrency scale to zero.",
    iconId: "lambda",
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
    codename: "GATE PROTOCOL",
    category: "APP-NET",
    tagline: "The front door for your APIs.",
    description:
      "Throttling, authorization, request validation, transformation — follow a request through every stage of the API Gateway lifecycle.",
    iconId: "api-gateway",
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
    codename: "SIGNAL BURST",
    category: "APP-NET",
    tagline: "Publish once. Fan out everywhere.",
    description:
      "Topics deliver to SQS, Lambda, HTTP, email and mobile push. Fire a message and watch the fan-out storm hit every subscriber.",
    iconId: "sns",
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
    codename: "MESSAGE BUFFER",
    category: "APP-NET",
    tagline: "Decouple everything. Lose nothing.",
    description:
      "Managed message queues with visibility timeouts, dead-letter queues and near-unlimited throughput. Push messages and drain the queue with consumers.",
    iconId: "sqs",
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
    codename: "EDGE MIRROR",
    category: "EDGE",
    tagline: "Content cached at the edge of the world.",
    description:
      "600+ edge locations cache your origin. Race a cache MISS against a cache HIT and see why latency drops from hundreds of ms to single digits.",
    iconId: "cloudfront",
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
    codename: "SYNC SHADOW",
    category: "DATA",
    tagline: "Managed SQL. Multi-AZ. Zero patching.",
    description:
      "Managed PostgreSQL, MySQL, MariaDB, Oracle and SQL Server with Aurora. Watch synchronous Multi-AZ replication, async read-replica lag, automatic failover and RDS Proxy connection pooling — live.",
    iconId: "rds",
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
    codename: "SIGNAL SCOPE",
    category: "OPS",
    tagline: "Metrics, alarms, actions. Total observability.",
    description:
      "Every service streams metrics to CloudWatch. Threshold alarms evaluate datapoints, fire SNS notifications and trigger Auto Scaling actions — follow the full signal path from metric to remediation.",
    iconId: "cloudwatch",
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
    codename: "ORCHESTRATOR",
    category: "COMPUTE",
    tagline: "Ship containers, not servers. ECS, EKS, ECR.",
    description:
      "ECS schedules tasks from ECR images across EC2 or Fargate capacity; EKS runs upstream Kubernetes. Deploy a new image live, autoscale on CPU and watch tasks drain and replace with zero downtime.",
    iconId: "containers",
    stats: [
      { label: "LAUNCH TYPE", value: "EC2/FARGATE" },
      { label: "ORCHESTRATOR", value: "ECS + EKS" },
      { label: "REGISTRY", value: "ECR" },
      { label: "DEPLOY", value: "ROLLING" },
    ],
  },
];

export const SERVICE_MAP: Record<string, ServiceMeta> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s])
);
