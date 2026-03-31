# General DWG Request API Documentation

## Overview

The General DWG Request API manages the workflow for drawing requests in the MTC Engineering department. It handles the complete lifecycle from request submission through 6 workflow stages to final completion.

**Base URL:** `http://localhost:2005/api/engineer/mtc/tool-requests`

---

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Workflow Stages

```
Eng Check → Draft Man → DWG Check → Eng Review → Eng Approve → Eng Inform
```

| Stage | Key | Responsible | Action |
|-------|-----|-------------|--------|
| Eng Check | `eng_check` | Engineer | Approve/Deny + Assign Request No. |
| Draft Man | `draft_man` | Draftsman | Submit Drawing |
| DWG Check | `dwg_check` | DWG Checker | Approve/Deny Drawing |
| Eng Review | `eng_review` | Engineer | Review + Classify |
| Eng Approve | `eng_approve` | Head Engineer | Final Approval |
| Eng Inform | `eng_inform` | Engineer | Inform Cost + Evidence |

---

## Endpoints

### 1. List All Requests

**GET** `/api/engineer/mtc/tool-requests`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (e.g., "Pending Eng Check") |
| `search` | string | Search in request_item, title, requester |
| `startDate` | date | Filter by created date (YYYY-MM-DD) |
| `endDate` | date | Filter by created date (YYYY-MM-DD) |
| `page` | integer | Page number (default: 1, max: 100) |
| `limit` | integer | Items per page (default: 50, max: 200) |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "request_item": "ITEM-20260331-001",
      "req_no": "DWG-2024-001",
      "requester": "John Doe",
      "requester_email": "john.doe@minebea.co.th",
      "department": "Engineering",
      "work_center": "ENG001",
      "work_center_name": "Engineering Dept",
      "type_of_request": "Regist Drawing",
      "category": "Machine part",
      "title": "Bearing Housing Design",
      "detail": "New design for bearing housing...",
      "status": "Pending Eng Check",
      "current_stage": "Eng Check",
      "req_due_date": "2026-04-07T00:00:00Z",
      "created_at": "2026-03-31T08:30:00Z",
      "updated_at": "2026-03-31T08:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

---

### 2. Get Request Details

**GET** `/api/engineer/mtc/tool-requests/:id`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Request ID |

**Response:**
```json
{
  "data": {
    "id": 1,
    "request_item": "ITEM-20260331-001",
    "req_no": "DWG-2024-001",
    "requester": "John Doe",
    "department": "Engineering",
    "title": "Bearing Housing Design",
    "status": "Pending Eng Check",
    "current_stage": "Eng Check",
    "workflow": [
      {
        "id": 1,
        "req_id": 1,
        "step_no": 1,
        "action_by": "Jane Smith",
        "action_type": "approve",
        "comment": "Approved - proceed to drafting",
        "status": "Pending Draft Man",
        "stage_name": "eng_check",
        "extra_data": {
          "request_no": "DWG-2024-001"
        },
        "created_at": "2026-03-31T09:00:00Z"
      }
    ]
  }
}
```

---

### 3. Create New Request

**POST** `/api/engineer/mtc/tool-requests`

**Content-Type:** `multipart/form-data`

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department` | string | Yes | Department name |
| `work_center` | string | Yes | Work center code |
| `work_center_name` | string | No | Work center name |
| `requester` | string | Yes | Requester name |
| `requester_email` | string | No | Requester email |
| `type_of_request` | string | Yes | Regist Drawing / Draft Drawing / 3D Print |
| `category` | string | Yes | Machine part / Gauge / Other |
| `drawing_required` | string | No | With Drawing / Without Drawing |
| `type_of_drawing` | string | No | Copy / Remake / New Design / Modify |
| `title` | string | Yes | Request title (max 200 chars) |
| `detail` | string | Yes | Request details (max 2000 chars) |
| `machine_no` | string | No | Machine number |
| `machine_name` | string | No | Machine name |
| `attachment` | file | No | Attachment file (PDF, DWG, DXF, Image) |

**Request Example:**
```bash
curl -X POST http://localhost:2005/api/engineer/mtc/tool-requests \
  -F "department=Engineering" \
  -F "work_center=ENG001" \
  -F "requester=John Doe" \
  -F "type_of_request=Regist Drawing" \
  -F "category=Machine part" \
  -F "title=Bearing Housing Design" \
  -F "detail=New design for bearing housing..." \
  -F "attachment=@drawing.pdf"
```

**Response:**
```json
{
  "result": "true",
  "message": "บันทึกคำขอเรียบร้อยแล้ว",
  "id": 123
}
```

---

### 4. Update Request

**PUT** `/api/engineer/mtc/tool-requests/:id`

**Content-Type:** `application/json` or `multipart/form-data`

**Body Parameters:** (all optional)
| Parameter | Type | Description |
|-----------|------|-------------|
| `department` | string | Update department |
| `work_center` | string | Update work center |
| `type_of_request` | string | Update request type |
| `category` | string | Update category |
| `title` | string | Update title |
| `detail` | string | Update details |
| `status` | string | Update status |
| `current_stage` | string | Update current stage |
| `req_no` | string | Update request number |
| `attachment` | file | New attachment |

**Response:**
```json
{
  "result": "true",
  "message": "อัพเดทข้อมูลเรียบร้อยแล้ว",
  "changes": 1
}
```

---

### 5. Delete Request

**DELETE** `/api/engineer/mtc/tool-requests/:id`

**Description:** Soft-delete (sets `deleted_at` timestamp)

**Response:**
```json
{
  "result": "true",
  "message": "ลบข้อมูลเรียบร้อยแล้ว"
}
```

---

### 6. Submit Workflow Action

**POST** `/api/engineer/mtc/tool-requests/:id/action`

**Content-Type:** `multipart/form-data` or `application/json`

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stage` | string | Yes | Stage key (e.g., "eng_check") |
| `decision` | string | Yes | "approve", "deny", or "submit" |
| `comment` | string | Conditional | Required when denying |
| `action_by` | string | Yes | User performing action |
| `action_by_email` | string | No | User email |
| `user_department` | string | No | User department (AD bypass) |
| `user_code` | string | No | User code for permission check |
| `extra` | object | Conditional | Stage-specific data |

**Stage-Specific Extra Data:**

**Eng Check:**
```json
{
  "request_no": "DWG-2024-001"
}
```

**Draft Man:**
```json
{
  "dwg_files": "\\\\server\\drawings\\DWG-001.pdf",
  "comment": "Drawing completed"
}
```

**Eng Review:**
```json
{
  "drawing_no": "ENG-DWG-2024-001",
  "no_of_dwg": 3,
  "section": "Mechanical",
  "review_general": "Single part",
  "review_machine_part": "Maintenance",
  "review_gauge_type": "Inspection"
}
```

**Eng Inform:**
```json
{
  "cost": "5,000 THB",
  "evidence": "Invoice #12345",
  "inform_note": "Please proceed with procurement"
}
```

**Request Example:**
```bash
curl -X POST http://localhost:2005/api/engineer/mtc/tool-requests/123/action \
  -F "stage=eng_check" \
  -F "decision=approve" \
  -F "comment=Approved - proceed to drafting" \
  -F "extra={\"request_no\":\"DWG-2024-001\"}" \
  -F "action_by=Jane Smith" \
  -F "action_by_email=jane.smith@minebea.co.th"
```

**Response:**
```json
{
  "success": true,
  "request_item": "ITEM-20260331-001",
  "status": "Pending Draft Man",
  "current_stage": "Draft Man",
  "message": "eng_check approve submitted successfully"
}
```

---

### 7. Get Dashboard Statistics

**GET** `/api/engineer/mtc/tool-requests/dashboard`

**Response:**
```json
{
  "data": {
    "total": 150,
    "byStatus": {
      "Pending Eng Check": 12,
      "Pending Draft Man": 8,
      "Pending DWG Check": 5,
      "Pending Eng Review": 10,
      "Pending Eng Approve": 7,
      "Pending Eng Inform": 3,
      "Completed & Informed": 95,
      "Denied": 10
    },
    "last30Days": 45,
    "overdue": 5
  }
}
```

---

### 8. Get Stage Permissions

**GET** `/api/engineer/mtc/tool-requests/permissions`

**Response:**
```json
{
  "data": {
    "eng_check": ["engineer1@minebea.co.th", "engineer2@minebea.co.th"],
    "draft_man": ["draftman1@minebea.co.th"],
    "dwg_check": ["dwgchecker1@minebea.co.th"],
    "eng_review": ["reviewer1@minebea.co.th"],
    "eng_approve": ["approver1@minebea.co.th"],
    "eng_inform": ["inform1@minebea.co.th"]
  }
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Error Response Format

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

---

## Rate Limiting

- Maximum 200 records per request
- Requests are limited to prevent abuse

---

## File Upload

**Supported File Types:** PDF, DWG, DXF, PNG, JPG, JPEG

**Maximum File Size:** 10MB

**Storage Location:** `./files/tool_requests/`

**File Naming:** `{timestamp}_{random}_{originalname}`

---

## Email Notifications

Email notifications are sent automatically at each workflow stage:

| Stage | Action | Recipients |
|-------|--------|------------|
| Eng Check | Approve | Draft Man team |
| Eng Check | Deny | Requester |
| Draft Man | Submit | DWG Check team |
| DWG Check | Approve | Eng Review team |
| DWG Check | Deny | Draft Man, Requester |
| Eng Review | Approve | Eng Approve team |
| Eng Approve | Approve | Eng Inform team |
| Eng Approve | Deny | Requester |
| Eng Inform | Complete | Requester |

---

## Database Schema

### tr_request Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| request_item | VARCHAR(50) | Auto-generated item number |
| req_no | VARCHAR(50) | Official request number |
| requester | VARCHAR(100) | Requester name |
| requester_email | VARCHAR(150) | Requester email |
| department | VARCHAR(100) | Department |
| work_center | VARCHAR(50) | Work center code |
| work_center_name | VARCHAR(100) | Work center name |
| type_of_request | VARCHAR(50) | Request type |
| category | VARCHAR(50) | Category |
| drawing_required | VARCHAR(50) | Drawing requirement |
| type_of_drawing | VARCHAR(50) | Drawing type |
| title | VARCHAR(200) | Request title |
| detail | TEXT | Request details |
| machine_no | VARCHAR(50) | Machine number |
| machine_name | VARCHAR(100) | Machine name |
| req_due_date | TIMESTAMPTZ | Due date |
| status | VARCHAR(50) | Current status |
| current_stage | VARCHAR(50) | Current workflow stage |
| file_path | VARCHAR(255) | Attachment path |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |
| deleted_at | TIMESTAMPTZ | Soft delete timestamp |

### tr_workflow Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| req_id | INTEGER | Foreign key to tr_request |
| step_no | INTEGER | Step number (1-6) |
| action_by | VARCHAR(100) | User who performed action |
| action_date | TIMESTAMPTZ | Action timestamp |
| action_type | VARCHAR(20) | approve/deny/submit |
| comment | TEXT | Comment |
| status | VARCHAR(50) | Resulting status |
| stage_name | VARCHAR(50) | Stage key |
| extra_data | JSONB | Stage-specific data |
| created_at | TIMESTAMPTZ | Creation timestamp |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-31 | Initial release with workflow system |

---

## Support

For API support, contact the ENG System development team.
