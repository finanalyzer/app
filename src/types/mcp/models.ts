import { z } from 'zod';

export type BridgeErrorCode = z.infer<typeof BridgeErrorCodeSchema>;
export const BridgeErrorCodeSchema = z.enum([
  'invalid_request',
  'unauthorized',
  'unavailable',
  'timeout',
  'command_failed',
  'unknown',
]);

export type NavigationOperation = z.infer<typeof NavigationOperationSchema>;
export const NavigationOperationSchema = z.enum(['create', 'add_tabs', 'remove_tabs', 'rename_tabs']);

export type GenerativeWidgetType = z.infer<typeof GenerativeWidgetTypeSchema>;
export const GenerativeWidgetTypeSchema = z.enum(['note', 'table', 'chart', 'html']);

export type DashboardOperation = z.infer<typeof DashboardOperationSchema>;
export const DashboardOperationSchema = z.enum(['create', 'read', 'update']);

export type WorkspaceNavigationOperation = z.infer<typeof WorkspaceNavigationOperationSchema>;
export const WorkspaceNavigationOperationSchema = z.enum(['dashboard', 'tab']);

export type BackendsOperation = z.infer<typeof BackendsOperationSchema>;
export const BackendsOperationSchema = z.enum(['list', 'add', 'update', 'refresh', 'remove']);

export type AppsOperation = z.infer<typeof AppsOperationSchema>;
export const AppsOperationSchema = z.enum(['list', 'read', 'instantiate']);

export type EndpointHeaderLocation = z.infer<typeof EndpointHeaderLocationSchema>;
export const EndpointHeaderLocationSchema = z.enum(['headers', 'query']);

export type BridgePayload = Record<string, unknown>;
export type BridgePayloadList = BridgePayload[];

export function newRequestId(): string {
  return `cmd_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function widgetGroups(): Record<string, BridgePayload[]> {
  return { primary: [], secondary: [], extra: [] };
}

export const BridgeErrorSchema = z.object({
  code: BridgeErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  retryable: z.boolean().default(false),
});

export type BridgeError = z.infer<typeof BridgeErrorSchema>;

export const BrowserSessionStartRequestSchema = z.object({
  client_name: z.string().default('workspace-ui'),
  current_dashboard_id: z.string().optional(),
  current_tab_id: z.string().optional(),
});

export type BrowserSessionStartRequest = z.infer<typeof BrowserSessionStartRequestSchema>;

export const BrowserSessionContextSchema = z.object({
  current_dashboard_id: z.string().optional(),
  current_tab_id: z.string().optional(),
});

export type BrowserSessionContext = z.infer<typeof BrowserSessionContextSchema>;

export const BrowserSessionSchema = z.object({
  session_id: z.string(),
  token: z.string(),
  client_name: z.string(),
  current_dashboard_id: z.string().optional(),
  current_tab_id: z.string().optional(),
});

export type BrowserSession = z.infer<typeof BrowserSessionSchema>;

export const BrowserSessionStartResponseSchema = z.object({
  session: BrowserSessionSchema,
  websocket_url: z.string(),
});

export type BrowserSessionStartResponse = z.infer<typeof BrowserSessionStartResponseSchema>;

export const WorkspaceSnapshotSchema = z.object({
  generated_at: z.number(),
  workspace_state: z.unknown().optional(),
  workspace_options: z.array(z.string()).default([]),
  dashboards: z.array(z.record(z.string(), z.unknown())).default([]),
  dashboard_composition: z.record(z.string(), z.unknown()).optional(),
  widgets: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).default(widgetGroups),
  context: z.array(z.record(z.string(), z.unknown())).default([]),
  artifacts: z.array(z.record(z.string(), z.unknown())).default([]),
  files: z.array(z.record(z.string(), z.unknown())).default([]),
  tools: z.array(z.unknown()).default([]),
  skills: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

export const WorkspaceWidgetConfigSchema = z.object({
  data_args: z.record(z.string(), z.unknown()).optional(),
  ui_args: z.record(z.string(), z.unknown()).optional(),
});

export type WorkspaceWidgetConfig = z.infer<typeof WorkspaceWidgetConfigSchema>;

export const WidgetDataRequestSchema = z.object({
  origin: z.string(),
  widget_id: z.string(),
  data_args: z.record(z.string(), z.unknown()).default({}),
  widget_uuid: z.string().optional(),
  ssm_request: z.record(z.string(), z.unknown()).optional(),
});

export type WidgetDataRequest = z.infer<typeof WidgetDataRequestSchema>;

export const ParamOptionsRequestSchema = z.object({
  origin: z.string(),
  widget_id: z.string(),
  param_name: z.string(),
  data_args: z.record(z.string(), z.unknown()).default({}),
});

export type ParamOptionsRequest = z.infer<typeof ParamOptionsRequestSchema>;

export const GetWidgetDataCommandSchema = z.object({
  command: z.literal('get_widget_data'),
  request_id: z.string().optional(),
  data_sources: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type GetWidgetDataCommand = z.infer<typeof GetWidgetDataCommandSchema>;

export const ListAvailableWidgetsCommandSchema = z.object({
  command: z.literal('list_available_widgets'),
  request_id: z.string().optional(),
  origin: z.string().optional(),
  backend_id: z.string().optional(),
});

export type ListAvailableWidgetsCommand = z.infer<typeof ListAvailableWidgetsCommandSchema>;

export const GetWidgetSchemaCommandSchema = z.object({
  command: z.literal('get_widget_schema'),
  request_id: z.string().optional(),
  origin: z.string(),
  widget_id: z.string(),
});

export type GetWidgetSchemaCommand = z.infer<typeof GetWidgetSchemaCommandSchema>;

export const GetParamOptionsCommandSchema = z.object({
  command: z.literal('get_params_options'),
  request_id: z.string().optional(),
  param_options_queries: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type GetParamOptionsCommand = z.infer<typeof GetParamOptionsCommandSchema>;

export const ReadWidgetCommandSchema = z.object({
  command: z.literal('read_widget'),
  request_id: z.string().optional(),
  dashboard_id: z.string().optional(),
  widget_uuid: z.string().optional(),
  widget_id: z.string().optional(),
});

export type ReadWidgetCommand = z.infer<typeof ReadWidgetCommandSchema>;

export const CreateWidgetCommandSchema = z.object({
  command: z.literal('create_widget'),
  request_id: z.string().optional(),
  dashboard_id: z.string().optional(),
  backend_name: z.string(),
  widget_id: z.string(),
  config: WorkspaceWidgetConfigSchema.optional(),
});

export type CreateWidgetCommand = z.infer<typeof CreateWidgetCommandSchema>;

export const UpdateWidgetCommandSchema = z.object({
  command: z.literal('update_widget'),
  request_id: z.string().optional(),
  dashboard_id: z.string().optional(),
  widget_uuid: z.string().optional(),
  widget_id: z.string().optional(),
  config: WorkspaceWidgetConfigSchema,
});

export type UpdateWidgetCommand = z.infer<typeof UpdateWidgetCommandSchema>;

export const DeleteWidgetCommandSchema = z.object({
  command: z.literal('delete_widget'),
  request_id: z.string().optional(),
  dashboard_id: z.string().optional(),
  widget_uuid: z.string().optional(),
  widget_id: z.string().optional(),
});

export type DeleteWidgetCommand = z.infer<typeof DeleteWidgetCommandSchema>;

export const ManageDashboardCommandSchema = z.object({
  command: z.literal('manage_dashboard'),
  request_id: z.string().optional(),
  operation: DashboardOperationSchema,
  dashboard_id: z.string().optional(),
  name: z.string().optional(),
  activate: z.boolean().optional(),
});

export type ManageDashboardCommand = z.infer<typeof ManageDashboardCommandSchema>;

export const NavigateWorkspaceCommandSchema = z.object({
  command: z.literal('navigate_workspace'),
  request_id: z.string().optional(),
  operation: WorkspaceNavigationOperationSchema,
  dashboard_id: z.string().optional(),
  tab_id: z.string().optional(),
});

export type NavigateWorkspaceCommand = z.infer<typeof NavigateWorkspaceCommandSchema>;

export const UpdateDashboardLayoutCommandSchema = z.object({
  command: z.literal('update_dashboard_layout'),
  request_id: z.string().optional(),
  dashboard_id: z.string().optional(),
  widget_uuid: z.string().optional(),
  widget_id: z.string().optional(),
  tab_id: z.string().optional(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  min_w: z.number().optional(),
  min_h: z.number().optional(),
  max_w: z.number().optional(),
  max_h: z.number().optional(),
});

export type UpdateDashboardLayoutCommand = z.infer<typeof UpdateDashboardLayoutCommandSchema>;

export const ManageNavigationBarCommandSchema = z.object({
  command: z.literal('manage_navigation_bar'),
  request_id: z.string().optional(),
  dashboard_id: z.string().optional(),
  operation: NavigationOperationSchema,
  tabs: z.array(z.record(z.string(), z.unknown())).default([]),
  rename_map: z.record(z.string(), z.string()).default({}),
});

export type ManageNavigationBarCommand = z.infer<typeof ManageNavigationBarCommandSchema>;

export const AddGenerativeWidgetCommandSchema = z.object({
  command: z.literal('add_generative_widget'),
  request_id: z.string().optional(),
  dashboard_id: z.string().optional(),
  widget_type: GenerativeWidgetTypeSchema,
  data: z.union([z.array(z.record(z.string(), z.unknown())), z.string()]).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  chart_params: z.record(z.string(), z.unknown()).optional(),
  inner_tab: z.string().optional(),
});

export type AddGenerativeWidgetCommand = z.infer<typeof AddGenerativeWidgetCommandSchema>;

export const AssignTasksToAgentsCommandSchema = z.object({
  command: z.literal('assign_tasks_to_agents'),
  request_id: z.string().optional(),
  task_requests: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type AssignTasksToAgentsCommand = z.infer<typeof AssignTasksToAgentsCommandSchema>;

export const GetSkillContentCommandSchema = z.object({
  command: z.literal('get_skill_content'),
  request_id: z.string().optional(),
  slug: z.string(),
  reason: z.string().optional(),
});

export type GetSkillContentCommand = z.infer<typeof GetSkillContentCommandSchema>;

export const GetWorkspaceSnapshotCommandSchema = z.object({
  command: z.literal('get_workspace_snapshot'),
  request_id: z.string().optional(),
});

export type GetWorkspaceSnapshotCommand = z.infer<typeof GetWorkspaceSnapshotCommandSchema>;

export const BackendEndpointHeaderSchema = z.object({
  key: z.string(),
  value: z.string(),
  location: EndpointHeaderLocationSchema.default('headers'),
});

export type BackendEndpointHeader = z.infer<typeof BackendEndpointHeaderSchema>;

export const NavigationTabInputSchema = z.object({
  name: z.string().min(1),
});

export type NavigationTabInput = z.infer<typeof NavigationTabInputSchema>;

export const TaskRequestSchema = z.object({
  id: z.string(),
  description: z.string(),
  assigned_holder_url: z.string(),
  assigned_agent_id: z.string(),
});

export type TaskRequest = z.infer<typeof TaskRequestSchema>;

export const ManageBackendsCommandSchema = z.object({
  command: z.literal('manage_backends'),
  request_id: z.string().optional(),
  operation: BackendsOperationSchema,
  backend_id: z.string().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  endpoint_headers: z.array(BackendEndpointHeaderSchema).optional(),
  validate_widgets: z.boolean().optional(),
  is_openbb_platform: z.boolean().optional(),
});

export type ManageBackendsCommand = z.infer<typeof ManageBackendsCommandSchema>;

export const ManageAppsCommandSchema = z.object({
  command: z.literal('manage_apps'),
  request_id: z.string().optional(),
  operation: AppsOperationSchema,
  backend_id: z.string(),
  app_name: z.string().optional(),
  template_id: z.string().optional(),
  dashboard_name: z.string().optional(),
  activate: z.boolean().optional(),
});

export type ManageAppsCommand = z.infer<typeof ManageAppsCommandSchema>;

export const WorkspaceCommandSchema = z.discriminatedUnion('command', [
  GetWidgetDataCommandSchema,
  ListAvailableWidgetsCommandSchema,
  GetWidgetSchemaCommandSchema,
  GetParamOptionsCommandSchema,
  ReadWidgetCommandSchema,
  CreateWidgetCommandSchema,
  UpdateWidgetCommandSchema,
  DeleteWidgetCommandSchema,
  ManageDashboardCommandSchema,
  UpdateDashboardLayoutCommandSchema,
  NavigateWorkspaceCommandSchema,
  ManageNavigationBarCommandSchema,
  AddGenerativeWidgetCommandSchema,
  AssignTasksToAgentsCommandSchema,
  GetSkillContentCommandSchema,
  GetWorkspaceSnapshotCommandSchema,
  ManageBackendsCommandSchema,
  ManageAppsCommandSchema,
]);

export type WorkspaceCommand = z.infer<typeof WorkspaceCommandSchema>;

export const WorkspaceCommandResultSchema = z.object({
  ok: z.boolean(),
  command: z.string(),
  request_id: z.string().optional(),
  message: z.string(),
  data: z.unknown().optional(),
  error: BridgeErrorSchema.optional(),
});

export type WorkspaceCommandResult = z.infer<typeof WorkspaceCommandResultSchema>;

export const BrowserCommandResultMessageSchema = z.object({
  type: z.literal('command_result'),
  result: WorkspaceCommandResultSchema,
});

export type BrowserCommandResultMessage = z.infer<typeof BrowserCommandResultMessageSchema>;

export const BrowserPingSchema = z.object({
  type: z.literal('ping'),
});

export type BrowserPing = z.infer<typeof BrowserPingSchema>;

export const BrowserSessionContextChangedMessageSchema = z.object({
  type: z.literal('session_context_changed'),
  session: BrowserSessionContextSchema,
});

export type BrowserSessionContextChangedMessage = z.infer<typeof BrowserSessionContextChangedMessageSchema>;

export const BrowserMessageSchema = z.discriminatedUnion('type', [
  BrowserCommandResultMessageSchema,
  BrowserPingSchema,
  BrowserSessionContextChangedMessageSchema,
]);

export type BrowserMessage = z.infer<typeof BrowserMessageSchema>;

export const SessionReadyEventSchema = z.object({
  type: z.literal('session_ready'),
  session: BrowserSessionSchema,
});

export type SessionReadyEvent = z.infer<typeof SessionReadyEventSchema>;

export const CommandRequestEventSchema = z.object({
  type: z.literal('command_request'),
  command: WorkspaceCommandSchema,
});

export type CommandRequestEvent = z.infer<typeof CommandRequestEventSchema>;

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  error: BridgeErrorSchema,
});

export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

export const PongEventSchema = z.object({
  type: z.literal('pong'),
});

export type PongEvent = z.infer<typeof PongEventSchema>;

export const ServerEventSchema = z.discriminatedUnion('type', [
  SessionReadyEventSchema,
  CommandRequestEventSchema,
  ErrorEventSchema,
  PongEventSchema,
]);

export type ServerEvent = z.infer<typeof ServerEventSchema>;

export const workspaceCommandAdapter = WorkspaceCommandSchema;
export const browserMessageAdapter = BrowserMessageSchema;
