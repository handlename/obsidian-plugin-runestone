# Runestone Workflow Examples

This document contains complete workflow examples for reference when creating Runestone workflows.
Each example includes all node `.md` file contents and the complete `.canvas` JSON.

---

## Example 1: Simple Pipeline

A two-node pipeline where the first node fetches system information as JSON and the second node formats a human-readable summary from it.

### Node Files

#### `workflows/simple-pipeline/fetch-info.md`

```md
---
runestone.type: exec
runestone.onError: stop
---

```bash
# Output system info as JSON
echo "{\"hostname\": \"$(hostname)\", \"date\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"user\": \"$(whoami)\"}"
```
```

#### `workflows/simple-pipeline/format-summary.md`

```md
---
runestone.type: script
runestone.onError: stop
---

```javascript
// input[0] is the parsed JSON output from the previous exec node
const info = input[0];
const summary = `Host: ${info.hostname}\nDate: ${info.date}\nUser: ${info.user}`;
return summary;
```
```

### Canvas JSON

```json
{
  "nodes": [
    {
      "id": "a1b2c3d4e5f6a7b8",
      "type": "file",
      "file": "workflows/simple-pipeline/fetch-info.md",
      "x": 0,
      "y": 0,
      "width": 250,
      "height": 60
    },
    {
      "id": "b2c3d4e5f6a7b8c9",
      "type": "file",
      "file": "workflows/simple-pipeline/format-summary.md",
      "x": 300,
      "y": 0,
      "width": 250,
      "height": 60
    }
  ],
  "edges": [
    {
      "id": "c3d4e5f6a7b8c9d0",
      "fromNode": "a1b2c3d4e5f6a7b8",
      "toNode": "b2c3d4e5f6a7b8c9",
      "fromSide": "right",
      "toSide": "left"
    }
  ]
}
```

---

## Example 2: Conditional Branching

A workflow that runs a health check, routes to a success handler or failure handler based on the result, and always runs a notification node via the default (unlabeled) edge from the condition node.

### Node Files

#### `workflows/conditional-branching/run-health-check.md`

```md
---
runestone.type: exec
runestone.onError: stop
---

```bash
# Check if a service is responding; output result as JSON
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
if [ "$STATUS" = "200" ]; then
  echo "{\"status\": \"ok\", \"code\": $STATUS}"
else
  echo "{\"status\": \"error\", \"code\": $STATUS}"
fi
```
```

#### `workflows/conditional-branching/check-status.md`

```md
---
runestone.type: condition
runestone.onError: stop
---

```javascript
// Route based on the status field from the health check output
const result = input[0];
if (result.status === "ok") {
  return "success";
}
return "failure";
```
```

#### `workflows/conditional-branching/handle-success.md`

```md
---
runestone.type: script
runestone.onError: stop
---

```javascript
// input[0] is the original health check result passed through from condition
const result = input[0];
return `Service is healthy (HTTP ${result.code}). No action required.`;
```
```

#### `workflows/conditional-branching/handle-failure.md`

```md
---
runestone.type: script
runestone.onError: stop
---

```javascript
// input[0] is the original health check result passed through from condition
const result = input[0];
return `Service is DOWN (HTTP ${result.code}). Alerting on-call team.`;
```
```

#### `workflows/conditional-branching/send-notification.md`

```md
---
runestone.type: script
runestone.onError: stop
---

```javascript
// Default (unlabeled) edge from condition — always runs regardless of branch outcome.
// input[0] is the original health check result.
const result = input[0];
const timestamp = new Date().toISOString();
return `[${timestamp}] Health check completed with status: ${result.status}`;
```
```

### Canvas JSON

```json
{
  "nodes": [
    {
      "id": "d4e5f6a7b8c9d0e1",
      "type": "file",
      "file": "workflows/conditional-branching/run-health-check.md",
      "x": 0,
      "y": 0,
      "width": 250,
      "height": 60
    },
    {
      "id": "e5f6a7b8c9d0e1f2",
      "type": "file",
      "file": "workflows/conditional-branching/check-status.md",
      "x": 300,
      "y": 0,
      "width": 250,
      "height": 60
    },
    {
      "id": "f6a7b8c9d0e1f2a3",
      "type": "file",
      "file": "workflows/conditional-branching/handle-success.md",
      "x": 600,
      "y": -100,
      "width": 250,
      "height": 60
    },
    {
      "id": "a7b8c9d0e1f2a3b4",
      "type": "file",
      "file": "workflows/conditional-branching/handle-failure.md",
      "x": 600,
      "y": 0,
      "width": 250,
      "height": 60
    },
    {
      "id": "b8c9d0e1f2a3b4c5",
      "type": "file",
      "file": "workflows/conditional-branching/send-notification.md",
      "x": 600,
      "y": 100,
      "width": 250,
      "height": 60
    }
  ],
  "edges": [
    {
      "id": "c9d0e1f2a3b4c5d6",
      "fromNode": "d4e5f6a7b8c9d0e1",
      "toNode": "e5f6a7b8c9d0e1f2",
      "fromSide": "right",
      "toSide": "left"
    },
    {
      "id": "d0e1f2a3b4c5d6e7",
      "fromNode": "e5f6a7b8c9d0e1f2",
      "toNode": "f6a7b8c9d0e1f2a3",
      "fromSide": "right",
      "toSide": "left",
      "label": "success"
    },
    {
      "id": "e1f2a3b4c5d6e7f8",
      "fromNode": "e5f6a7b8c9d0e1f2",
      "toNode": "a7b8c9d0e1f2a3b4",
      "fromSide": "right",
      "toSide": "left",
      "label": "failure"
    },
    {
      "id": "f2a3b4c5d6e7f8a9",
      "fromNode": "e5f6a7b8c9d0e1f2",
      "toNode": "b8c9d0e1f2a3b4c5",
      "fromSide": "right",
      "toSide": "left"
    }
  ]
}
```

---

## Example 3: With Args

A workflow where an args node supplies configuration (target directory and file extension) to a script node that counts matching files. An exec node starts the workflow and produces the initial file list.

### Node Files

#### `workflows/with-args/list-files.md`

```md
---
runestone.type: exec
runestone.onError: stop
---

```bash
# List files in the current directory as a JSON array
FILES=$(ls -1 . | jq -R . | jq -s .)
echo "{\"files\": $FILES}"
```
```

#### `workflows/with-args/search-config.md`

```md
---
runestone.type: args
---

```javascript
// Provide configuration for the filter-files script node
return {
  extension: ".md",
  maxResults: 10
};
```
```

#### `workflows/with-args/filter-files.md`

```md
---
runestone.type: script
runestone.onError: stop
---

```javascript
// input[0] is the JSON output from the exec node (file listing)
// args contains the configuration from the args node
const { files } = input[0];
const { extension, maxResults } = args;

const filtered = files
  .filter(f => f.endsWith(extension))
  .slice(0, maxResults);

return {
  extension,
  count: filtered.length,
  files: filtered
};
```
```

### Canvas JSON

```json
{
  "nodes": [
    {
      "id": "a9b0c1d2e3f4a5b6",
      "type": "file",
      "file": "workflows/with-args/list-files.md",
      "x": 0,
      "y": 0,
      "width": 250,
      "height": 60
    },
    {
      "id": "b0c1d2e3f4a5b6c7",
      "type": "file",
      "file": "workflows/with-args/search-config.md",
      "x": 0,
      "y": 120,
      "width": 250,
      "height": 60
    },
    {
      "id": "c1d2e3f4a5b6c7d8",
      "type": "file",
      "file": "workflows/with-args/filter-files.md",
      "x": 300,
      "y": 0,
      "width": 250,
      "height": 60
    }
  ],
  "edges": [
    {
      "id": "d2e3f4a5b6c7d8e9",
      "fromNode": "a9b0c1d2e3f4a5b6",
      "toNode": "c1d2e3f4a5b6c7d8",
      "fromSide": "right",
      "toSide": "left"
    },
    {
      "id": "e3f4a5b6c7d8e9f0",
      "fromNode": "b0c1d2e3f4a5b6c7",
      "toNode": "c1d2e3f4a5b6c7d8",
      "fromSide": "right",
      "toSide": "left"
    }
  ]
}
```
