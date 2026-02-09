# Test Results

## Testing Protocol
- Backend testing using deep_testing_backend_v2
- Frontend testing using auto_frontend_testing_agent  
- Always update this file before invoking testing agents

## Incorporate User Feedback
- Apply user feedback directly without asking clarifying questions

## Current Task
Add server load statistics tab to admin panel.

### Backend Changes
- New endpoint: `GET /api/admin/server-stats` - returns CPU, RAM, Disk, uptime, MongoDB stats, process info, network, top processes
- Added `psutil` dependency

### Frontend Changes  
- New "Сервер" tab in AdminPanel with gauges, charts, MongoDB & process stats

### Backend Test
- `GET /api/admin/server-stats` — ✅ Returns correct JSON with all metrics

## New Backend Endpoints Added
- DELETE /api/rooms/{room_id}/participants/{target_id} - Kick participant (body: {kicked_by: int, reason?: str})
- PUT /api/rooms/{room_id}/transfer-ownership - Transfer ownership (body: {current_owner: int, new_owner: int})
- PUT /api/group-tasks/{task_id}/comments/{comment_id} - Edit comment (body: {telegram_id: int, text: str})
- DELETE /api/group-tasks/{task_id}/comments/{comment_id} - Delete comment (body: {telegram_id: int})
- PUT /api/group-tasks/{task_id}/pin - Pin/unpin task (body: {telegram_id: int, pinned: bool})
- GET /api/rooms/{room_id}/tasks - Updated with query params: ?status=&priority=&assigned_to=&sort_by=

## Backend Testing Plan
Prerequisites:
1. Create user: POST /api/user-settings with {telegram_id: 11111, username: "testowner", first_name: "Owner", group_id: "G1", group_name: "G1", facultet_id: "F1", level_id: "L1", kurs: "1", form_code: "ОФО"}
2. Create user: POST /api/user-settings with {telegram_id: 22222, ...same, first_name: "Member"}
3. Create room: POST /api/rooms with {name: "Test", telegram_id: 11111}
4. Join room with second user via invite_token: POST /api/rooms/join/{token} with {telegram_id: 22222, first_name: "Member", username: "testmember"}
5. Create task in room: POST /api/group-tasks with {title: "Test", telegram_id: 11111, room_id: <room_id>, priority: "high"}
6. Create second task: POST /api/group-tasks with {title: "Low Priority", telegram_id: 11111, room_id: <room_id>, priority: "low"}

### Tests:
1. PIN: PUT /api/group-tasks/{task_id}/pin with {telegram_id: 11111, pinned: true} → expect pinned=true
2. UNPIN: PUT /api/group-tasks/{task_id}/pin with {telegram_id: 11111, pinned: false} → expect pinned=false
3. PIN by non-owner: PUT /api/group-tasks/{task_id}/pin with {telegram_id: 99999, pinned: true} → expect 403
4. FILTER by priority: GET /api/rooms/{room_id}/tasks?priority=high → expect 1 task
5. FILTER by status: GET /api/rooms/{room_id}/tasks?status=created → expect 2 tasks
6. SORT by priority: GET /api/rooms/{room_id}/tasks?sort_by=priority → expect high first
7. ADD COMMENT: POST /api/group-tasks/{task_id}/comments with {task_id: <id>, telegram_id: 22222, text: "Hello"}
8. EDIT COMMENT: PUT /api/group-tasks/{task_id}/comments/{comment_id} with {telegram_id: 22222, text: "Edited"}
9. EDIT by wrong user: PUT /api/group-tasks/{task_id}/comments/{comment_id} with {telegram_id: 11111, text: "Hack"} → expect 403
10. DELETE COMMENT: DELETE /api/group-tasks/{task_id}/comments/{comment_id} with {telegram_id: 22222}
11. TRANSFER OWNERSHIP: PUT /api/rooms/{room_id}/transfer-ownership with {current_owner: 11111, new_owner: 22222} → expect success
12. KICK (by new owner): DELETE /api/rooms/{room_id}/participants/11111 with {kicked_by: 22222} → expect success
13. Verify room has 1 participant left

## Test Status
- [ ] Backend tests
- [ ] Frontend tests
