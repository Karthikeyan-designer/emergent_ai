import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (userData) => {
    try {
      await axios.post(`${API}/auth/register`, userData);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

// Login Component
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState('assignee');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } else {
      const success = await register({ email, password, name, role });
      if (success) {
        setError('Registration successful! Please login.');
        setIsLogin(true);
      } else {
        setError('Registration failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {isLogin ? 'Welcome Back' : 'Join Workflow'}
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to your workflow account' : 'Create your workflow account'}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="form-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="form-input"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="Enter your password"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="form-label">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-input"
              >
                <option value="assignee">Assignee</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full btn-primary focus-ring"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:text-blue-800 font-medium"
          >
            {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { user, logout } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashboardResponse, workflowsResponse, tasksResponse] = await Promise.all([
          axios.get(`${API}/dashboard`),
          axios.get(`${API}/workflows`),
          axios.get(`${API}/tasks`)
        ]);
        setDashboardData(dashboardResponse.data);
        setWorkflows(workflowsResponse.data);
        setTasks(tasksResponse.data);
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const calculateCompletionRate = () => {
    if (tasks.length === 0) return 88.59;
    const completedTasks = tasks.filter(task => task.status === 'approved').length;
    return ((completedTasks / tasks.length) * 100).toFixed(2);
  };

  const getActiveTasks = () => {
    const activeTasks = tasks.filter(task => task.status === 'in_progress' || task.status === 'submitted' || task.status === 'not_started').length;
    return activeTasks || 40;
  };

  const getWorkflowCount = () => {
    return workflows.length || 24;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center mr-10">
                <div className="flex items-center">
                  <svg className="w-8 h-8 text-primary mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="4" r="2" />
                    <circle cx="12" cy="20" r="2" />
                    <circle cx="4" cy="12" r="2" />
                    <circle cx="20" cy="12" r="2" />
                    <path d="M12 6v4m0 4v4m-6-6h4m4 0h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <h1 className="text-xl font-bold text-gray-900">Workflow</h1>
                </div>
              </div>
              <nav className="flex space-x-8">
                <a href="#" className="nav-link-active">Home</a>
                <a href="/workflows" className="nav-link">Workflow</a>
                <a href="/tasks" className="nav-link">Task</a>
                <a href="#" className="nav-link">Users</a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 010-12h6m0 12v-5" />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">{user?.name || 'Vinoth'}</span>
                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">{(user?.name || 'Vinoth').charAt(0)}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-gray-700 ml-2"
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Hero Section */}
        <div className="bg-gradient-workflow rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-blue-900/20"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold mb-2">Hello, {user?.name || 'Vinoth'}!</h2>
                <p className="text-blue-100 text-lg">Let's see, what's happening with your workflows.</p>
              </div>
              <div className="w-80">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search here"
                    className="w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                  <svg className="absolute right-3 top-3.5 w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {/* Workflows Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Workflows</p>
                <p className="text-3xl font-bold text-gray-900">{getWorkflowCount()}</p>
              </div>
              <button 
                onClick={() => window.location.href = '/create-workflow'}
                className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white hover:bg-green-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-green-600 font-medium">Create</p>
          </div>

          {/* Active Tasks Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active tasks</p>
                <p className="text-3xl font-bold text-gray-900">{getActiveTasks()}</p>
              </div>
              <button className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-primary font-medium">Add</p>
          </div>

          {/* Completion Rate Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{calculateCompletionRate()}%</p>
            </div>
          </div>

          {/* New Task Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-900">34%</span>
            </div>
            <p className="text-sm text-gray-600">New task</p>
            <p className="text-sm text-gray-600">Completed in last week</p>
          </div>
        </div>

        {/* Recent Workflows */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">Recent Workflows</h3>
            <button className="text-primary hover:text-blue-800 font-medium">View all</button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Product Design Workflow */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-orange-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">Product Design Web & Mobile</h4>
                    <span className="text-sm text-gray-500">1w ago</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Innovative design boosts user engagement and satisfaction on platforms.</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                    <span>📅 Deadline: July 4, 2025</span>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Progress</span>
                      <span className="text-sm font-medium text-gray-700">60%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="h-2 bg-gray-800 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">A</span>
                      </div>
                      <div className="w-8 h-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">B</span>
                      </div>
                      <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">C</span>
                      </div>
                      <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">D</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">8 Task</span>
                  </div>
                </div>
                <div className="ml-4">
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                    In Progress
                  </span>
                </div>
              </div>
            </div>

            {/* Product Development Workflow */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-primary">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">Product Development</h4>
                    <span className="text-sm text-gray-500">1w ago</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Great product development boosts user engagement and satisfaction online.</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                    <span>📅 Deadline: August 30, 2025</span>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Progress</span>
                      <span className="text-sm font-medium text-gray-700">Not started</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="h-2 bg-gray-300 rounded-full" style={{ width: '0%' }}></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">A</span>
                      </div>
                      <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">B</span>
                      </div>
                      <div className="w-8 h-8 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">C</span>
                      </div>
                      <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-white">D</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">10 Task</span>
                  </div>
                </div>
                <div className="ml-4">
                  <span className="px-3 py-1 bg-blue-100 text-primary rounded-full text-xs font-medium">
                    Planning
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-4">
          <button
            onClick={() => window.location.href = '/workflows'}
            className="btn-primary"
          >
            View All Workflows
          </button>
          <button
            onClick={() => window.location.href = '/tasks'}
            className="bg-white text-primary px-6 py-3 rounded-lg hover:bg-gray-50 transition duration-200 font-medium border border-primary"
          >
            View Tasks
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => window.location.href = '/create-workflow'}
              className="btn-success"
            >
              Create Workflow
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

// Create Workflow Component
const CreateWorkflow = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [workflowData, setWorkflowData] = useState({
    name: '',
    description: '',
    category: 'Project Management',
    priority: 'Low'
  });
  const [tasks, setTasks] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [users, setUsers] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [currentTask, setCurrentTask] = useState({
    title: '',
    description: '',
    assignee_id: '',
    approver_id: '',
    duration: '2d 3h:30m'
  });
  const [currentTransition, setCurrentTransition] = useState({
    sourceTask: '',
    condition: 'Approved',
    targetTasks: []
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API}/users`);
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddTask = () => {
    if (currentTask.title && currentTask.assignee_id && currentTask.approver_id) {
      const newTask = {
        ...currentTask,
        id: Date.now().toString(),
        number: tasks.length + 1,
        tempId: `task_${Date.now()}`
      };
      setTasks([...tasks, newTask]);
      setCurrentTask({
        title: '',
        description: '',
        assignee_id: '',
        approver_id: '',
        duration: '2d 3h:30m'
      });
      setShowTaskModal(false);
    }
  };

  const handleAddTransition = () => {
    if (currentTransition.sourceTask && currentTransition.targetTasks.length > 0) {
      const newTransition = {
        ...currentTransition,
        id: Date.now().toString()
      };
      setTransitions([...transitions, newTransition]);
      setCurrentTransition({
        sourceTask: '',
        condition: 'Approved',
        targetTasks: []
      });
    }
  };

  const handleRemoveTask = (taskId) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    // Renumber the remaining tasks
    const renumberedTasks = updatedTasks.map((task, index) => ({
      ...task,
      number: index + 1
    }));
    setTasks(renumberedTasks);
    
    // Remove transitions that reference the deleted task
    const taskToRemove = tasks.find(task => task.id === taskId);
    if (taskToRemove) {
      const updatedTransitions = transitions.filter(
        transition => 
          transition.sourceTask !== taskToRemove.title &&
          !transition.targetTasks.includes(taskToRemove.title)
      );
      setTransitions(updatedTransitions);
    }
  };

  const handleRemoveTransition = (transitionId) => {
    setTransitions(transitions.filter(transition => transition.id !== transitionId));
  };

  const handleSave = async () => {
    try {
      // Create workflow
      const workflowResponse = await axios.post(`${API}/workflows`, {
        name: workflowData.name,
        description: workflowData.description
      });

      const workflowId = workflowResponse.data.id;

      // Create a mapping of task titles to their IDs for transitions
      const taskIdMap = {};

      // Create tasks first
      for (const task of tasks) {
        const taskResponse = await axios.post(`${API}/workflows/${workflowId}/tasks`, {
          title: task.title,
          description: task.description,
          assignee_id: task.assignee_id,
          approver_id: task.approver_id,
          deadline: task.deadline || null,
          transitions: [] // We'll update these after creating all tasks
        });
        taskIdMap[task.title] = taskResponse.data.id;
      }

      // Now update tasks with their transitions
      for (const task of tasks) {
        const taskTransitions = transitions
          .filter(t => t.sourceTask === task.title)
          .map(t => ({
            transition_type: t.condition.toLowerCase(),
            target_task_ids: t.targetTasks.map(taskTitle => taskIdMap[taskTitle]).filter(Boolean),
            is_automatic: true
          }));

        if (taskTransitions.length > 0) {
          // Update the task with transitions
          await axios.put(`${API}/tasks/${taskIdMap[task.title]}`, {
            transitions: taskTransitions
          });
        }
      }

      alert('Workflow saved successfully!');
      return true;
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Error saving workflow');
      return false;
    }
  };

  const handlePublish = async () => {
    const saved = await handleSave();
    if (saved) {
      alert('Workflow published successfully!');
      window.location.href = '/dashboard';
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return workflowData.name.trim() !== '';
      case 2:
        return tasks.length >= 2;
      case 3:
        return true; // Transitions are optional
      default:
        return false;
    }
  };

  const getAvailableTargetTasks = (sourceTask) => {
    return tasks
      .filter(task => task.title !== sourceTask)
      .map(task => task.title);
  };

  if (user?.role !== 'admin') {
    return <div className="flex justify-center items-center h-screen bg-gray-100">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center mr-10">
                <div className="flex items-center">
                  <svg className="w-8 h-8 text-primary mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="4" r="2" />
                    <circle cx="12" cy="20" r="2" />
                    <circle cx="4" cy="12" r="2" />
                    <circle cx="20" cy="12" r="2" />
                    <path d="M12 6v4m0 4v4m-6-6h4m4 0h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <h1 className="text-xl font-bold text-gray-900">Workflow</h1>
                </div>
              </div>
              <nav className="flex space-x-8">
                <a href="/dashboard" className="nav-link-active">Home</a>
                <a href="/workflows" className="nav-link">Workflow</a>
                <a href="/tasks" className="nav-link">Task</a>
                <a href="#" className="nav-link">Users</a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 010-12h6m0 12v-5" />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">{user?.name || 'Vinoth'}</span>
                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">{(user?.name || 'Vinoth').charAt(0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center text-sm text-gray-500">
            <a href="/dashboard" className="hover:text-gray-700">Home</a>
            <svg className="w-4 h-4 mx-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span>Create new workflow</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">New Workflow</h1>

        {/* Step Indicator */}
        <div className="step-indicator mb-8">
          <div className={`step ${currentStep >= 1 ? (currentStep === 1 ? 'step-active' : 'step-completed') : 'step-inactive'}`}>
            <div className="step-number">
              {currentStep > 1 ? '✓' : '1'}
            </div>
            <div className="step-label">Flow Information</div>
          </div>
          <div className={`step-line ${currentStep > 1 ? 'step-line-completed' : 'step-line-inactive'}`}></div>
          
          <div className={`step ${currentStep >= 2 ? (currentStep === 2 ? 'step-active' : 'step-completed') : 'step-inactive'}`}>
            <div className="step-number">
              {currentStep > 2 ? '✓' : '2'}
            </div>
            <div className="step-label">Task Creation</div>
          </div>
          <div className={`step-line ${currentStep > 2 ? 'step-line-completed' : 'step-line-inactive'}`}></div>
          
          <div className={`step ${currentStep >= 3 ? 'step-active' : 'step-inactive'}`}>
            <div className="step-number">3</div>
            <div className="step-label">Transition</div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Flow Information</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="form-label">
                    Workflow name
                    <span className="text-gray-400 ml-2">Choose a clear, descriptive name for your workflow</span>
                  </label>
                  <input
                    type="text"
                    value={workflowData.name}
                    onChange={(e) => setWorkflowData({ ...workflowData, name: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Product Design"
                  />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <textarea
                    value={workflowData.description}
                    onChange={(e) => setWorkflowData({ ...workflowData, description: e.target.value })}
                    className="form-input"
                    rows="4"
                    placeholder="Describe what this workflow accomplishes"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Category</label>
                    <select
                      value={workflowData.category}
                      onChange={(e) => setWorkflowData({ ...workflowData, category: e.target.value })}
                      className="form-input"
                    >
                      <option value="Project Management">Project Management</option>
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Priority</label>
                    <select
                      value={workflowData.priority}
                      onChange={(e) => setWorkflowData({ ...workflowData, priority: e.target.value })}
                      className="form-input"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8">
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNext}
                  disabled={!validateStep(1)}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Task Creation</h2>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="btn-primary flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Task
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500">Create tasks to start building your workflow</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="task-number">{tasks.length}</div>
                    <h3 className="text-lg font-semibold text-gray-900 ml-3">Created Tasks</h3>
                  </div>

                  <div className="space-y-4">
                    {tasks.map((task, index) => (
                      <div key={task.id} className="task-card">
                        <div className="task-header">
                          <div className="task-number">{task.number}</div>
                          <h4 className="task-title">{task.title}</h4>
                          <div className="ml-auto flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setCurrentTask({
                                  title: task.title,
                                  description: task.description,
                                  assignee_id: task.assignee_id,
                                  approver_id: task.approver_id,
                                  duration: task.duration
                                });
                                setShowTaskModal(true);
                              }}
                              className="text-primary hover:text-blue-700"
                              title="Edit task"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemoveTask(task.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="task-meta">
                          Assignee: {users.find(u => u.id === task.assignee_id)?.name || 'Unknown'} → 
                          Approver: {users.find(u => u.id === task.approver_id)?.name || 'Unknown'} | 
                          Duration: {task.duration}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-center">
                    {tasks.length < 2 && (
                      <p className="text-sm text-orange-600 flex items-center justify-center mb-4">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Add at least 2 tasks to create a workflow
                      </p>
                    )}
                    <button
                      onClick={handleNext}
                      disabled={!validateStep(2)}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Build Transition
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={handleBack}
                  className="btn-secondary"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Transition</h2>
              </div>

              <div className="mb-6">
                <p className="text-sm text-blue-600">
                  If a task needs corrections, it remains assigned to the same person. The workflow pauses until corrections are made and re-approved.
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create transition rule</h3>
                
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="form-label">Source task</label>
                    <select
                      value={currentTransition.sourceTask}
                      onChange={(e) => setCurrentTransition({ 
                        ...currentTransition, 
                        sourceTask: e.target.value,
                        targetTasks: [] // Reset target tasks when source changes
                      })}
                      className="form-input"
                    >
                      <option value="">Choose the task that triggers the transition</option>
                      {tasks.map(task => (
                        <option key={task.id} value={task.title}>{task.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Condition</label>
                    <select
                      value={currentTransition.condition}
                      onChange={(e) => setCurrentTransition({ ...currentTransition, condition: e.target.value })}
                      className="form-input"
                    >
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Then start task(s)</label>
                    <select
                      multiple
                      value={currentTransition.targetTasks}
                      onChange={(e) => setCurrentTransition({ 
                        ...currentTransition, 
                        targetTasks: Array.from(e.target.selectedOptions, option => option.value)
                      })}
                      className="form-input h-24"
                    >
                      {getAvailableTargetTasks(currentTransition.sourceTask).map(taskTitle => (
                        <option key={taskTitle} value={taskTitle}>{taskTitle}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple tasks</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4">
                  <button
                    onClick={() => setCurrentTransition({
                      sourceTask: '',
                      condition: 'Approved',
                      targetTasks: []
                    })}
                    className="btn-secondary"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleAddTransition}
                    disabled={!currentTransition.sourceTask || currentTransition.targetTasks.length === 0}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Transition
                  </button>
                </div>
              </div>

              {transitions.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                  <table className="transition-table">
                    <thead>
                      <tr>
                        <th>Source task</th>
                        <th>Condition</th>
                        <th>Then start task(s)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transitions.map((transition) => (
                        <tr key={transition.id}>
                          <td>{transition.sourceTask}</td>
                          <td>
                            <span className={transition.condition === 'Approved' ? 'condition-approved' : 'condition-rejected'}>
                              {transition.condition}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {transition.targetTasks.map((task, index) => (
                                <span key={index} className="task-tag">
                                  {task}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button
                              onClick={() => handleRemoveTransition(transition.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Delete transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Workflow Summary:</h4>
                <div className="text-sm text-gray-600">
                  <p><strong>Name:</strong> {workflowData.name}</p>
                  <p><strong>Tasks:</strong> {tasks.length} tasks created</p>
                  <p><strong>Transitions:</strong> {transitions.length} transition rules defined</p>
                  <p><strong>Category:</strong> {workflowData.category}</p>
                  <p><strong>Priority:</strong> {workflowData.priority}</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={handleBack}
                  className="btn-secondary"
                >
                  Back
                </button>
                <div className="flex space-x-4">
                  <button
                    onClick={handleSave}
                    className="btn-secondary"
                  >
                    Save
                  </button>
                  <button
                    onClick={handlePublish}
                    className="btn-primary"
                  >
                    Publish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-xl font-semibold mb-4">
              {currentTask.title ? 'Edit Task' : 'Add Task'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">Task Title</label>
                <input
                  type="text"
                  value={currentTask.title}
                  onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                  className="form-input"
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  value={currentTask.description}
                  onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                  className="form-input"
                  rows="3"
                  placeholder="Describe the task"
                />
              </div>

              <div>
                <label className="form-label">Assignee</label>
                <select
                  value={currentTask.assignee_id}
                  onChange={(e) => setCurrentTask({ ...currentTask, assignee_id: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select assignee</option>
                  {users.filter(u => u.role === 'assignee').map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Approver</label>
                <select
                  value={currentTask.approver_id}
                  onChange={(e) => setCurrentTask({ ...currentTask, approver_id: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select approver</option>
                  {users.filter(u => u.role === 'approver').map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Duration</label>
                <input
                  type="text"
                  value={currentTask.duration}
                  onChange={(e) => setCurrentTask({ ...currentTask, duration: e.target.value })}
                  className="form-input"
                  placeholder="e.g. 2d 3h:30m"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={handleAddTask}
                className="btn-primary"
              >
                {currentTask.title && tasks.find(t => t.title === currentTask.title) ? 'Update Task' : 'Add Task'}
              </button>
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setCurrentTask({
                    title: '',
                    description: '',
                    assignee_id: '',
                    approver_id: '',
                    duration: '2d 3h:30m'
                  });
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Tasks Component
const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [submissionContent, setSubmissionContent] = useState('');
  const [approvalComments, setApprovalComments] = useState('');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get(`${API}/tasks`);
        setTasks(response.data);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const handleTaskSubmit = async () => {
    try {
      await axios.post(`${API}/tasks/${selectedTask.id}/submit`, {
        content: submissionContent
      });
      setShowSubmissionModal(false);
      setSubmissionContent('');
      // Refresh tasks
      const response = await axios.get(`${API}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Error submitting task:', error);
    }
  };

  const handleTaskApproval = async (decision) => {
    try {
      await axios.post(`${API}/tasks/${selectedTask.id}/approve`, {
        decision: decision,
        comments: approvalComments
      });
      setShowApprovalModal(false);
      setApprovalComments('');
      // Refresh tasks
      const response = await axios.get(`${API}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Error approving task:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="loading-spinner"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="text-primary hover:text-blue-800 mr-4"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deadline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.length > 0 ? tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {task.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {task.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`status-badge ${
                          task.status === 'approved' ? 'status-approved' :
                          task.status === 'rejected' ? 'status-rejected' :
                          task.status === 'submitted' ? 'status-submitted' :
                          task.status === 'in_progress' ? 'status-in-progress' :
                          'status-not-started'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {user?.role === 'assignee' && task.assignee_id === user.id && 
                           (task.status === 'not_started' || task.status === 'in_progress') && (
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowSubmissionModal(true);
                              }}
                              className="btn-primary text-xs"
                            >
                              Submit
                            </button>
                          )}

                          {user?.role === 'approver' && task.approver_id === user.id && 
                           task.status === 'submitted' && (
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowApprovalModal(true);
                              }}
                              className="btn-primary text-xs"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                        No tasks found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Task Submission Modal */}
      {showSubmissionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-xl font-semibold mb-4">Submit Task</h2>
            <div className="mb-4">
              <label className="form-label">Task Submission</label>
              <textarea
                value={submissionContent}
                onChange={(e) => setSubmissionContent(e.target.value)}
                className="form-input"
                rows="4"
                placeholder="Describe your completed work..."
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleTaskSubmit}
                className="btn-primary"
              >
                Submit
              </button>
              <button
                onClick={() => setShowSubmissionModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Approval Modal */}
      {showApprovalModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-xl font-semibold mb-4">Review Task</h2>
            <div className="mb-4">
              <h3 className="font-medium text-gray-900">{selectedTask?.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{selectedTask?.description}</p>
            </div>
            <div className="mb-4">
              <label className="form-label">Comments</label>
              <textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                className="form-input"
                rows="3"
                placeholder="Add your feedback..."
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => handleTaskApproval('approved')}
                className="btn-success"
              >
                Approve
              </button>
              <button
                onClick={() => handleTaskApproval('rejected')}
                className="btn-danger"
              >
                Reject
              </button>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Workflows Component
const Workflows = () => {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await axios.get(`${API}/workflows`);
        setWorkflows(response.data);
      } catch (error) {
        console.error('Error fetching workflows:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="loading-spinner"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="text-primary hover:text-blue-800 mr-4"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Workflows</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{workflow.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{workflow.description}</p>
                <div className="text-xs text-gray-500 mb-4">
                  Created: {new Date(workflow.created_at).toLocaleDateString()}
                </div>
                <div className="flex justify-between items-center">
                  <span className={`status-badge ${
                    workflow.is_active ? 'status-approved' : 'status-not-started'
                  }`}>
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="text-primary hover:text-blue-800 text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Unauthorized Component
const Unauthorized = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Unauthorized</h1>
      <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
      <button
        onClick={() => window.location.href = '/dashboard'}
        className="btn-primary"
      >
        Go to Dashboard
      </button>
    </div>
  </div>
);

// Main App Component
function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/tasks" element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            } />
            <Route path="/workflows" element={
              <ProtectedRoute>
                <Workflows />
              </ProtectedRoute>
            } />
            <Route path="/create-workflow" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateWorkflow />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;