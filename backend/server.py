from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = "your-secret-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    APPROVER = "approver"
    ASSIGNEE = "assignee"

class TaskStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"

class TransitionType(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    password_hash: str
    role: UserRole
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: UserRole

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TaskTransition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transition_type: TransitionType  # approved or rejected
    target_task_ids: List[str]  # tasks to trigger
    is_automatic: bool = True

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    deadline: Optional[datetime] = None
    assignee_id: str
    approver_id: str
    workflow_id: str
    status: TaskStatus = TaskStatus.NOT_STARTED
    transitions: List[TaskTransition] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Workflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    tasks: List[Task] = []
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class TaskSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    assignee_id: str
    content: str
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    status: TaskStatus = TaskStatus.SUBMITTED

class TaskApproval(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    submission_id: str
    approver_id: str
    decision: str  # "approved" or "rejected"
    comments: str
    approved_at: datetime = Field(default_factory=datetime.utcnow)

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    user_id: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Create Models
class WorkflowCreate(BaseModel):
    name: str
    description: str

class TaskCreate(BaseModel):
    title: str
    description: str
    deadline: Optional[datetime] = None
    assignee_id: str
    approver_id: str
    transitions: List[TaskTransition] = []

class TaskSubmissionCreate(BaseModel):
    content: str

class TaskApprovalCreate(BaseModel):
    decision: str
    comments: str

class CommentCreate(BaseModel):
    content: str

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Core workflow engine
async def trigger_task_transitions(task_id: str, decision: str):
    """Core workflow engine - handles automatic task transitions"""
    try:
        # Get the task
        task_doc = await db.tasks.find_one({"id": task_id})
        if not task_doc:
            return
        
        task = Task(**task_doc)
        
        # Find matching transitions
        for transition in task.transitions:
            if transition.transition_type.value == decision and transition.is_automatic:
                # Trigger each target task
                for target_task_id in transition.target_task_ids:
                    await db.tasks.update_one(
                        {"id": target_task_id},
                        {"$set": {"status": TaskStatus.NOT_STARTED, "updated_at": datetime.utcnow()}}
                    )
                    
                    # Send notification to assignee (placeholder)
                    target_task_doc = await db.tasks.find_one({"id": target_task_id})
                    if target_task_doc:
                        print(f"Notification: Task {target_task_doc['title']} assigned to {target_task_doc['assignee_id']}")
        
        print(f"Task transitions triggered for task {task_id} with decision {decision}")
        
    except Exception as e:
        print(f"Error triggering transitions: {e}")

# Authentication endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    password_hash = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=password_hash,
        role=user_data.role
    )
    
    await db.users.insert_one(user.dict())
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": user_data.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**user_doc)
    
    # Verify password
    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={"id": user.id, "email": user.email, "name": user.name, "role": user.role}
    )

# Workflow endpoints
@api_router.post("/workflows", response_model=Workflow)
async def create_workflow(workflow_data: WorkflowCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create workflows")
    
    workflow = Workflow(
        name=workflow_data.name,
        description=workflow_data.description,
        created_by=current_user.id
    )
    
    await db.workflows.insert_one(workflow.dict())
    return workflow

@api_router.get("/workflows", response_model=List[Workflow])
async def get_workflows(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        workflows = await db.workflows.find().to_list(100)
    else:
        # Get workflows where user is involved
        user_tasks = await db.tasks.find({
            "$or": [
                {"assignee_id": current_user.id},
                {"approver_id": current_user.id}
            ]
        }).to_list(100)
        
        workflow_ids = list(set([task["workflow_id"] for task in user_tasks]))
        workflows = await db.workflows.find({"id": {"$in": workflow_ids}}).to_list(100)
    
    return [Workflow(**workflow) for workflow in workflows]

@api_router.get("/workflows/{workflow_id}", response_model=Workflow)
async def get_workflow(workflow_id: str, current_user: User = Depends(get_current_user)):
    workflow = await db.workflows.find_one({"id": workflow_id})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get tasks for this workflow
    tasks = await db.tasks.find({"workflow_id": workflow_id}).to_list(100)
    workflow["tasks"] = [Task(**task) for task in tasks]
    
    return Workflow(**workflow)

# Task endpoints
@api_router.post("/workflows/{workflow_id}/tasks", response_model=Task)
async def create_task(workflow_id: str, task_data: TaskCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create tasks")
    
    # Verify workflow exists
    workflow = await db.workflows.find_one({"id": workflow_id})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    task = Task(
        title=task_data.title,
        description=task_data.description,
        deadline=task_data.deadline,
        assignee_id=task_data.assignee_id,
        approver_id=task_data.approver_id,
        workflow_id=workflow_id,
        transitions=task_data.transitions
    )
    
    await db.tasks.insert_one(task.dict())
    return task

@api_router.get("/tasks", response_model=List[Task])
async def get_user_tasks(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        tasks = await db.tasks.find().to_list(100)
    elif current_user.role == UserRole.ASSIGNEE:
        tasks = await db.tasks.find({"assignee_id": current_user.id}).to_list(100)
    elif current_user.role == UserRole.APPROVER:
        tasks = await db.tasks.find({"approver_id": current_user.id}).to_list(100)
    else:
        tasks = []
    
    return [Task(**task) for task in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return Task(**task)

@api_router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, status: TaskStatus, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permissions
    if current_user.role == UserRole.ASSIGNEE and task["assignee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Task status updated"}

# Task submission endpoints
@api_router.post("/tasks/{task_id}/submit", response_model=TaskSubmission)
async def submit_task(task_id: str, submission_data: TaskSubmissionCreate, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task["assignee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    submission = TaskSubmission(
        task_id=task_id,
        assignee_id=current_user.id,
        content=submission_data.content
    )
    
    await db.task_submissions.insert_one(submission.dict())
    
    # Update task status
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": TaskStatus.SUBMITTED, "updated_at": datetime.utcnow()}}
    )
    
    return submission

@api_router.get("/tasks/{task_id}/submissions", response_model=List[TaskSubmission])
async def get_task_submissions(task_id: str, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    submissions = await db.task_submissions.find({"task_id": task_id}).to_list(100)
    return [TaskSubmission(**submission) for submission in submissions]

# Task approval endpoints
@api_router.post("/tasks/{task_id}/approve", response_model=TaskApproval)
async def approve_task(task_id: str, approval_data: TaskApprovalCreate, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task["approver_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get latest submission
    submission = await db.task_submissions.find_one(
        {"task_id": task_id},
        sort=[("submitted_at", -1)]
    )
    
    if not submission:
        raise HTTPException(status_code=400, detail="No submission found")
    
    approval = TaskApproval(
        task_id=task_id,
        submission_id=submission["id"],
        approver_id=current_user.id,
        decision=approval_data.decision,
        comments=approval_data.comments
    )
    
    await db.task_approvals.insert_one(approval.dict())
    
    # Update task status
    new_status = TaskStatus.APPROVED if approval_data.decision == "approved" else TaskStatus.REJECTED
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    # Trigger workflow transitions
    await trigger_task_transitions(task_id, approval_data.decision)
    
    return approval

# Comment endpoints
@api_router.post("/tasks/{task_id}/comments", response_model=Comment)
async def add_comment(task_id: str, comment_data: CommentCreate, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comment = Comment(
        task_id=task_id,
        user_id=current_user.id,
        content=comment_data.content
    )
    
    await db.comments.insert_one(comment.dict())
    return comment

@api_router.get("/tasks/{task_id}/comments", response_model=List[Comment])
async def get_task_comments(task_id: str, current_user: User = Depends(get_current_user)):
    comments = await db.comments.find({"task_id": task_id}).to_list(100)
    return [Comment(**comment) for comment in comments]

# Dashboard endpoints
@api_router.get("/dashboard")
async def get_dashboard(current_user: User = Depends(get_current_user)):
    dashboard_data = {}
    
    if current_user.role == UserRole.ADMIN:
        # Admin dashboard
        total_workflows = await db.workflows.count_documents({})
        total_tasks = await db.tasks.count_documents({})
        pending_tasks = await db.tasks.count_documents({"status": TaskStatus.SUBMITTED})
        
        dashboard_data = {
            "total_workflows": total_workflows,
            "total_tasks": total_tasks,
            "pending_approvals": pending_tasks,
            "role": "admin"
        }
        
    elif current_user.role == UserRole.ASSIGNEE:
        # Assignee dashboard
        my_tasks = await db.tasks.count_documents({"assignee_id": current_user.id})
        completed_tasks = await db.tasks.count_documents({
            "assignee_id": current_user.id,
            "status": {"$in": [TaskStatus.APPROVED, TaskStatus.REJECTED]}
        })
        pending_tasks = await db.tasks.count_documents({
            "assignee_id": current_user.id,
            "status": {"$in": [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS]}
        })
        
        dashboard_data = {
            "my_tasks": my_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "role": "assignee"
        }
        
    elif current_user.role == UserRole.APPROVER:
        # Approver dashboard
        pending_approvals = await db.tasks.count_documents({
            "approver_id": current_user.id,
            "status": TaskStatus.SUBMITTED
        })
        approved_tasks = await db.tasks.count_documents({
            "approver_id": current_user.id,
            "status": TaskStatus.APPROVED
        })
        rejected_tasks = await db.tasks.count_documents({
            "approver_id": current_user.id,
            "status": TaskStatus.REJECTED
        })
        
        dashboard_data = {
            "pending_approvals": pending_approvals,
            "approved_tasks": approved_tasks,
            "rejected_tasks": rejected_tasks,
            "role": "approver"
        }
    
    return dashboard_data

# Users endpoint for admin
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users = await db.users.find().to_list(100)
    return [User(**user) for user in users]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()