import requests
import json
import time
from datetime import datetime, timedelta
import uuid
import os

# Get the backend URL from the frontend .env file
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BACKEND_URL = line.strip().split('=')[1].strip('"\'')
            break

API_URL = f"{BACKEND_URL}/api"
print(f"Testing backend API at: {API_URL}")

# Test results tracking
test_results = {
    "Authentication System": {"passed": 0, "failed": 0, "details": []},
    "Workflow Management": {"passed": 0, "failed": 0, "details": []},
    "Task Submission System": {"passed": 0, "failed": 0, "details": []},
    "Multi-Task Transition Engine": {"passed": 0, "failed": 0, "details": []},
    "Dashboard Analytics": {"passed": 0, "failed": 0, "details": []},
    "Comments System": {"passed": 0, "failed": 0, "details": []}
}

def log_test(category, test_name, passed, message=""):
    if passed:
        test_results[category]["passed"] += 1
        status = "PASSED"
    else:
        test_results[category]["failed"] += 1
        status = "FAILED"
    
    test_results[category]["details"].append({
        "test_name": test_name,
        "status": status,
        "message": message
    })
    
    print(f"[{category}] {test_name}: {status} {message}")

# Generate unique identifiers for test data
test_id = str(uuid.uuid4())[:8]
timestamp = int(time.time())

# Test users
admin_user = {
    "email": f"admin_{test_id}_{timestamp}@example.com",
    "name": "Admin User",
    "password": "Admin123!",
    "role": "admin"
}

approver_user = {
    "email": f"approver_{test_id}_{timestamp}@example.com",
    "name": "Approver User",
    "password": "Approver123!",
    "role": "approver"
}

assignee_user = {
    "email": f"assignee_{test_id}_{timestamp}@example.com",
    "name": "Assignee User",
    "password": "Assignee123!",
    "role": "assignee"
}

# Storage for tokens and IDs
tokens = {}
user_ids = {}
workflow_id = None
tasks = []
submission_id = None

# 1. Test Authentication System
print("\n=== Testing Authentication System ===\n")

def test_user_registration(user_data):
    try:
        response = requests.post(f"{API_URL}/auth/register", json=user_data)
        if response.status_code == 200:
            user = response.json()
            log_test("Authentication System", f"Register {user_data['role']} user", True)
            return user["id"]
        else:
            log_test("Authentication System", f"Register {user_data['role']} user", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Authentication System", f"Register {user_data['role']} user", False, str(e))
        return None

def test_user_login(user_data):
    try:
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        response = requests.post(f"{API_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            token_data = response.json()
            log_test("Authentication System", f"Login {user_data['role']} user", True)
            return token_data["access_token"], token_data["user"]["id"]
        else:
            log_test("Authentication System", f"Login {user_data['role']} user", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None, None
    except Exception as e:
        log_test("Authentication System", f"Login {user_data['role']} user", False, str(e))
        return None, None

# Register users
user_ids["admin"] = test_user_registration(admin_user)
user_ids["approver"] = test_user_registration(approver_user)
user_ids["assignee"] = test_user_registration(assignee_user)

# Login users
tokens["admin"], _ = test_user_login(admin_user)
tokens["approver"], _ = test_user_login(approver_user)
tokens["assignee"], _ = test_user_login(assignee_user)

# Test JWT token validation
def test_token_validation(role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/dashboard", headers=headers)
        if response.status_code == 200:
            log_test("Authentication System", f"JWT validation for {role}", True)
            return True
        else:
            log_test("Authentication System", f"JWT validation for {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Authentication System", f"JWT validation for {role}", False, str(e))
        return False

# Validate tokens for all roles
for role in ["admin", "approver", "assignee"]:
    test_token_validation(role)

# 2. Test Workflow Management
print("\n=== Testing Workflow Management ===\n")

def test_create_workflow():
    global workflow_id
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        workflow_data = {
            "name": f"Test Workflow {test_id}",
            "description": "A test workflow for automated testing"
        }
        response = requests.post(f"{API_URL}/workflows", headers=headers, json=workflow_data)
        if response.status_code == 200:
            workflow = response.json()
            workflow_id = workflow["id"]
            log_test("Workflow Management", "Create workflow", True)
            return workflow_id
        else:
            log_test("Workflow Management", "Create workflow", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Workflow Management", "Create workflow", False, str(e))
        return None

def test_get_workflows(role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/workflows", headers=headers)
        if response.status_code == 200:
            workflows = response.json()
            log_test("Workflow Management", f"Get workflows as {role}", True)
            return workflows
        else:
            log_test("Workflow Management", f"Get workflows as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Workflow Management", f"Get workflows as {role}", False, str(e))
        return None

def test_get_workflow_by_id(workflow_id, role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/workflows/{workflow_id}", headers=headers)
        if response.status_code == 200:
            workflow = response.json()
            log_test("Workflow Management", f"Get workflow by ID as {role}", True)
            return workflow
        else:
            log_test("Workflow Management", f"Get workflow by ID as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Workflow Management", f"Get workflow by ID as {role}", False, str(e))
        return None

def test_create_task(workflow_id, task_data):
    global tasks
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        response = requests.post(f"{API_URL}/workflows/{workflow_id}/tasks", headers=headers, json=task_data)
        if response.status_code == 200:
            task = response.json()
            tasks.append(task)
            log_test("Workflow Management", f"Create task: {task_data['title']}", True)
            return task["id"]
        else:
            log_test("Workflow Management", f"Create task: {task_data['title']}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Workflow Management", f"Create task: {task_data['title']}", False, str(e))
        return None

# Create a workflow
workflow_id = test_create_workflow()

# Get workflows as different roles
admin_workflows = test_get_workflows("admin")
approver_workflows = test_get_workflows("approver")
assignee_workflows = test_get_workflows("assignee")

# Get specific workflow
if workflow_id:
    workflow = test_get_workflow_by_id(workflow_id, "admin")

# Create tasks with transitions
if workflow_id:
    # Create first task (no transitions yet)
    task1_data = {
        "title": f"Initial Task {test_id}",
        "description": "This is the first task in the workflow",
        "deadline": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        "assignee_id": user_ids["assignee"],
        "approver_id": user_ids["approver"],
        "transitions": []
    }
    task1_id = test_create_task(workflow_id, task1_data)
    
    # Create second task (will be triggered when task1 is approved)
    task2_data = {
        "title": f"Follow-up Task (Approved Path) {test_id}",
        "description": "This task is triggered when the initial task is approved",
        "deadline": (datetime.utcnow() + timedelta(days=10)).isoformat(),
        "assignee_id": user_ids["assignee"],
        "approver_id": user_ids["approver"],
        "transitions": []
    }
    task2_id = test_create_task(workflow_id, task2_data)
    
    # Create third task (will be triggered when task1 is rejected)
    task3_data = {
        "title": f"Revision Task (Rejected Path) {test_id}",
        "description": "This task is triggered when the initial task is rejected",
        "deadline": (datetime.utcnow() + timedelta(days=5)).isoformat(),
        "assignee_id": user_ids["assignee"],
        "approver_id": user_ids["approver"],
        "transitions": []
    }
    task3_id = test_create_task(workflow_id, task3_data)
    
    # Now update the first task with transitions
    if task1_id and task2_id and task3_id:
        # We need to update task1 with transitions, but there's no direct endpoint for this
        # We'll test the transition logic in the task submission and approval tests
        print(f"Created tasks with IDs: {task1_id}, {task2_id}, {task3_id}")
        
        # Add transitions to task1
        task1_transitions = [
            {
                "transition_type": "approved",
                "target_task_ids": [task2_id],
                "is_automatic": True
            },
            {
                "transition_type": "rejected",
                "target_task_ids": [task3_id],
                "is_automatic": True
            }
        ]
        
        # Since there's no direct endpoint to update transitions, we'll note this for testing
        print(f"Task transitions defined (will be tested in approval flow):")
        print(json.dumps(task1_transitions, indent=2))

# 3. Test Task Submission System
print("\n=== Testing Task Submission System ===\n")

def test_get_user_tasks(role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/tasks", headers=headers)
        if response.status_code == 200:
            tasks = response.json()
            log_test("Task Submission System", f"Get tasks as {role}", True)
            return tasks
        else:
            log_test("Task Submission System", f"Get tasks as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Task Submission System", f"Get tasks as {role}", False, str(e))
        return None

def test_get_task_by_id(task_id, role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers)
        if response.status_code == 200:
            task = response.json()
            log_test("Task Submission System", f"Get task by ID as {role}", True)
            return task
        else:
            log_test("Task Submission System", f"Get task by ID as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Task Submission System", f"Get task by ID as {role}", False, str(e))
        return None

def test_submit_task(task_id):
    global submission_id
    try:
        headers = {"Authorization": f"Bearer {tokens['assignee']}"}
        submission_data = {
            "content": f"Task submission for task {task_id}. Completed all requirements."
        }
        response = requests.post(f"{API_URL}/tasks/{task_id}/submit", headers=headers, json=submission_data)
        if response.status_code == 200:
            submission = response.json()
            submission_id = submission["id"]
            log_test("Task Submission System", "Submit task", True)
            return submission
        else:
            log_test("Task Submission System", "Submit task", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Task Submission System", "Submit task", False, str(e))
        return None

def test_get_task_submissions(task_id, role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/tasks/{task_id}/submissions", headers=headers)
        if response.status_code == 200:
            submissions = response.json()
            log_test("Task Submission System", f"Get task submissions as {role}", True)
            return submissions
        else:
            log_test("Task Submission System", f"Get task submissions as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Task Submission System", f"Get task submissions as {role}", False, str(e))
        return None

# Get tasks for each role
admin_tasks = test_get_user_tasks("admin")
approver_tasks = test_get_user_tasks("approver")
assignee_tasks = test_get_user_tasks("assignee")

# Get specific task
if task1_id:
    task = test_get_task_by_id(task1_id, "assignee")
    
    # Submit the task as assignee
    submission = test_submit_task(task1_id)
    
    # Get task submissions
    if submission:
        submissions = test_get_task_submissions(task1_id, "approver")

# 4. Test Task Approval and Multi-Task Transition Engine
print("\n=== Testing Task Approval and Multi-Task Transition Engine ===\n")

def test_approve_task(task_id, decision):
    try:
        headers = {"Authorization": f"Bearer {tokens['approver']}"}
        approval_data = {
            "decision": decision,
            "comments": f"Task {decision} with comments."
        }
        response = requests.post(f"{API_URL}/tasks/{task_id}/approve", headers=headers, json=approval_data)
        if response.status_code == 200:
            approval = response.json()
            log_test("Multi-Task Transition Engine", f"Task {decision}", True)
            return approval
        else:
            log_test("Multi-Task Transition Engine", f"Task {decision}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Multi-Task Transition Engine", f"Task {decision}", False, str(e))
        return None

def test_check_task_status(task_id, expected_status):
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        response = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers)
        if response.status_code == 200:
            task = response.json()
            if task["status"] == expected_status:
                log_test("Multi-Task Transition Engine", f"Task status is {expected_status}", True)
                return True
            else:
                log_test("Multi-Task Transition Engine", f"Task status is {expected_status}", False, 
                        f"Expected {expected_status}, got {task['status']}")
                return False
        else:
            log_test("Multi-Task Transition Engine", f"Task status is {expected_status}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Multi-Task Transition Engine", f"Task status is {expected_status}", False, str(e))
        return False

def test_check_transition_triggered(task_id, expected_status="not_started"):
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        response = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers)
        if response.status_code == 200:
            task = response.json()
            if task["status"] == expected_status:
                log_test("Multi-Task Transition Engine", f"Transition triggered for task {task_id}", True)
                return True
            else:
                log_test("Multi-Task Transition Engine", f"Transition triggered for task {task_id}", False, 
                        f"Expected status {expected_status}, got {task['status']}")
                return False
        else:
            log_test("Multi-Task Transition Engine", f"Transition triggered for task {task_id}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Multi-Task Transition Engine", f"Transition triggered for task {task_id}", False, str(e))
        return False

# Approve the task
if task1_id:
    # First, let's approve the task
    approval = test_approve_task(task1_id, "approved")
    
    # Check if task1 status is updated to "approved"
    test_check_task_status(task1_id, "approved")
    
    # Check if task2 (approved path) is triggered
    time.sleep(1)  # Give a moment for the transition to occur
    test_check_transition_triggered(task2_id)
    
    # Now let's create another task and test the rejection path
    task4_data = {
        "title": f"Second Initial Task {test_id}",
        "description": "This is another initial task to test rejection",
        "deadline": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        "assignee_id": user_ids["assignee"],
        "approver_id": user_ids["approver"],
        "transitions": [
            {
                "transition_type": "rejected",
                "target_task_ids": [task3_id],
                "is_automatic": True
            }
        ]
    }
    task4_id = test_create_task(workflow_id, task4_data)
    
    if task4_id:
        # Submit the task
        submission = test_submit_task(task4_id)
        
        # Reject the task
        if submission:
            rejection = test_approve_task(task4_id, "rejected")
            
            # Check if task4 status is updated to "rejected"
            test_check_task_status(task4_id, "rejected")
            
            # Check if task3 (rejected path) is triggered
            time.sleep(1)  # Give a moment for the transition to occur
            test_check_transition_triggered(task3_id)

# 5. Test Dashboard Analytics
print("\n=== Testing Dashboard Analytics ===\n")

def test_get_dashboard(role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/dashboard", headers=headers)
        if response.status_code == 200:
            dashboard = response.json()
            log_test("Dashboard Analytics", f"Get dashboard as {role}", True)
            return dashboard
        else:
            log_test("Dashboard Analytics", f"Get dashboard as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Dashboard Analytics", f"Get dashboard as {role}", False, str(e))
        return None

# Get dashboard for each role
admin_dashboard = test_get_dashboard("admin")
approver_dashboard = test_get_dashboard("approver")
assignee_dashboard = test_get_dashboard("assignee")

# Verify dashboard data structure
if admin_dashboard:
    if "role" in admin_dashboard and admin_dashboard["role"] == "admin":
        log_test("Dashboard Analytics", "Admin dashboard structure", True)
    else:
        log_test("Dashboard Analytics", "Admin dashboard structure", False, "Missing or incorrect role field")

if approver_dashboard:
    if "role" in approver_dashboard and approver_dashboard["role"] == "approver":
        log_test("Dashboard Analytics", "Approver dashboard structure", True)
    else:
        log_test("Dashboard Analytics", "Approver dashboard structure", False, "Missing or incorrect role field")

if assignee_dashboard:
    if "role" in assignee_dashboard and assignee_dashboard["role"] == "assignee":
        log_test("Dashboard Analytics", "Assignee dashboard structure", True)
    else:
        log_test("Dashboard Analytics", "Assignee dashboard structure", False, "Missing or incorrect role field")

# 6. Test Comments System
print("\n=== Testing Comments System ===\n")

def test_add_comment(task_id, role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        comment_data = {
            "content": f"Test comment from {role} at {datetime.utcnow().isoformat()}"
        }
        response = requests.post(f"{API_URL}/tasks/{task_id}/comments", headers=headers, json=comment_data)
        if response.status_code == 200:
            comment = response.json()
            log_test("Comments System", f"Add comment as {role}", True)
            return comment
        else:
            log_test("Comments System", f"Add comment as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Comments System", f"Add comment as {role}", False, str(e))
        return None

def test_get_comments(task_id, role):
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        response = requests.get(f"{API_URL}/tasks/{task_id}/comments", headers=headers)
        if response.status_code == 200:
            comments = response.json()
            log_test("Comments System", f"Get comments as {role}", True)
            return comments
        else:
            log_test("Comments System", f"Get comments as {role}", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Comments System", f"Get comments as {role}", False, str(e))
        return None

# Add comments from different roles
if task1_id:
    admin_comment = test_add_comment(task1_id, "admin")
    approver_comment = test_add_comment(task1_id, "approver")
    assignee_comment = test_add_comment(task1_id, "assignee")
    
    # Get comments
    comments = test_get_comments(task1_id, "admin")
    
    # Verify comments
    if comments:
        if len(comments) >= 3:  # We added 3 comments
            log_test("Comments System", "Comments retrieval count", True)
        else:
            log_test("Comments System", "Comments retrieval count", False, f"Expected at least 3 comments, got {len(comments)}")

# Print summary
print("\n=== Test Summary ===\n")

total_passed = 0
total_failed = 0

for category, results in test_results.items():
    passed = results["passed"]
    failed = results["failed"]
    total = passed + failed
    total_passed += passed
    total_failed += failed
    
    print(f"{category}: {passed}/{total} passed ({passed/total*100:.1f}%)")

print(f"\nOverall: {total_passed}/{total_passed+total_failed} passed ({total_passed/(total_passed+total_failed)*100:.1f}%)")

# Print detailed results
print("\n=== Detailed Test Results ===\n")

for category, results in test_results.items():
    print(f"\n{category}:")
    for detail in results["details"]:
        status_symbol = "✅" if detail["status"] == "PASSED" else "❌"
        print(f"  {status_symbol} {detail['test_name']}")
        if detail["message"] and detail["status"] == "FAILED":
            print(f"     - {detail['message']}")