export {
  SKILL_MD_TEMPLATE,
  SKILL_UI_MD_TEMPLATE,
  SKILL_REMOTE_MD_TEMPLATE,
  FILE_FORMAT_REFERENCE,
  CHANGE_REQUESTS_REFERENCE,
  BUGS_REFERENCE,
} from "./templates.generated.js";

const now = () => new Date().toISOString();

function mdTemplate(title: string, content: string): string {
  return `---
title: "${title}"
status: new
author: ""
last-modified: "${now()}"
version: "1.0"
---

${content}
`;
}

export interface ProjectInfo {
  description: string;
  branch?: string;
}

export const EMPTY_LOCK_TEMPLATE =
  () => `synced-at: "${new Date().toISOString()}"
files: {}
`;
