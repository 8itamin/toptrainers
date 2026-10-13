// Generated from backend OpenAPI. Do not edit.
export interface ClientCardWrite {
  display_name: string;
  contact_email?: string | null;
}
export interface ClientCardResponse {
  id: string;
  display_name: string;
  contact_email: string | null;
  client_account_id: string | null;
  relationship_id: string | null;
  group: string;
  created_at: string;
}
export interface ClientCardPage {
  items: Array<ClientCardResponse>;
  next_cursor: string | null;
  counts: Record<string, number>;
}
export interface JoinTokenRequest {
  token: string;
}
export interface JoinPreview {
  display_name: string;
  email_required: boolean;
}
export interface IssuedJoinInvitation {
  id: string;
  url: string;
  expires_at: string;
  delivery_status?: string | null;
}
export interface ClientProgramSummary {
  id: string;
  title: string;
  start_date: string;
  status: string;
  completed: number;
  total: number;
  completion: number | null;
}
export interface TrainerClientSummary {
  programs: Array<ClientProgramSummary>;
  completed_workouts: number;
  last_completed_at: string | null;
}
export const CLIENTS_OPERATIONS = {
  "list": {
    "method": "GET",
    "path": "/clients/cards",
    "operationId": "list_cards_api_v1_clients_cards_get"
  },
  "create": {
    "method": "POST",
    "path": "/clients/cards",
    "operationId": "create_card_api_v1_clients_cards_post"
  },
  "update": {
    "method": "PATCH",
    "path": "/clients/cards/{card_id}",
    "operationId": "update_card_api_v1_clients_cards__card_id__patch"
  },
  "invite": {
    "method": "POST",
    "path": "/clients/cards/{card_id}/invite",
    "operationId": "invite_api_v1_clients_cards__card_id__invite_post"
  },
  "email": {
    "method": "POST",
    "path": "/clients/cards/{card_id}/invite/email",
    "operationId": "email_invite_api_v1_clients_cards__card_id__invite_email_post"
  },
  "cancel": {
    "method": "POST",
    "path": "/clients/cards/{card_id}/invite/cancel",
    "operationId": "cancel_invite_api_v1_clients_cards__card_id__invite_cancel_post"
  },
  "preview": {
    "method": "POST",
    "path": "/clients/join/preview",
    "operationId": "preview_api_v1_clients_join_preview_post"
  },
  "accept": {
    "method": "POST",
    "path": "/clients/join/accept",
    "operationId": "accept_api_v1_clients_join_accept_post"
  },
  "terminate": {
    "method": "POST",
    "path": "/clients/relationships/{relationship_id}/terminate",
    "operationId": "terminate_relationship_api_v1_clients_relationships__relationship_id__terminate_post"
  },
  "summary": {
    "method": "GET",
    "path": "/clients/{client_id}/training-summary",
    "operationId": "training_summary_api_v1_clients__client_id__training_summary_get"
  }
} as const;
