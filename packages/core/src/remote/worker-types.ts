/** Worker registration response from the server */
export interface WorkerRegistration {
  id: string;
  project_id: string;
  name: string;
  status: string;
  agent: string;
  branch?: string;
  last_heartbeat_at: string | null;
  registered_at: string;
  is_online: boolean;
}

/** Job assignment returned by the poll endpoint */
export interface WorkerJobAssignment {
  job_id: string;
  entity_type: string | null;
  entity_id: string | null;
  prompt: string;
  agent: string;
  model?: string;
  branch?: string;
}

/** Answer message from the user */
export interface WorkerJobAnswer {
  id: string;
  job_id: string;
  kind: 'answer';
  content: string;
  sequence: number;
  created_at: string;
}

/** Local worker state persisted in .sdd/worker.json */
export interface WorkerState {
  workerId: string;
  name: string;
  registeredAt: string;
}
