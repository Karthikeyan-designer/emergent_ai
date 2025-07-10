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
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="assignee">Assignee</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:text-blue-800 font-medium"
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                  <svg className="w-8 h-8 text-blue-600 mr-2" viewBox="0 0 24 24" fill="currentColor">
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
                <a href="#" className="text-blue-600 font-medium px-3 py-2">Home</a>
                <a href="/workflows" className="text-gray-600 hover:text-gray-900 px-3 py-2">Workflow</a>
                <a href="/tasks" className="text-gray-600 hover:text-gray-900 px-3 py-2">Task</a>
                <a href="#" className="text-gray-600 hover:text-gray-900 px-3 py-2">Users</a>
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
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
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
              <button className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-blue-600 font-medium">Add</p>
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
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
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
            <button className="text-blue-600 hover:text-blue-800 font-medium">View all</button>
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
            <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-blue-500">
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
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
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
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
          >
            View All Workflows
          </button>
          <button
            onClick={() => window.location.href = '/tasks'}
            className="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-gray-50 transition duration-200 font-medium border border-blue-600"
          >
            View Tasks
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => window.location.href = '/create-workflow'}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition duration-200 font-medium"
            >
              Create Workflow
            </button>
          )}
        </div>
      </main>
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
    return <div className="flex justify-center items-center h-screen bg-gray-100">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="text-blue-600 hover:text-blue-800 mr-4"
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
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          task.status === 'approved' ? 'bg-green-100 text-green-800' :
                          task.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          task.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
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
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition duration-200"
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
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition duration-200"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Submit Task</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Submission
              </label>
              <textarea
                value={submissionContent}
                onChange={(e) => setSubmissionContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Describe your completed work..."
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleTaskSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
              >
                Submit
              </button>
              <button
                onClick={() => setShowSubmissionModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Review Task</h2>
            <div className="mb-4">
              <h3 className="font-medium text-gray-900">{selectedTask?.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{selectedTask?.description}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments
              </label>
              <textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Add your feedback..."
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => handleTaskApproval('approved')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
              >
                Approve
              </button>
              <button
                onClick={() => handleTaskApproval('rejected')}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Reject
              </button>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-200"
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

// Create Workflow Component
const CreateWorkflow = () => {
  const { user } = useAuth();
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [currentTask, setCurrentTask] = useState({
    title: '',
    description: '',
    assignee_id: '',
    approver_id: '',
    transitions: []
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

  const handleCreateWorkflow = async () => {
    try {
      // Create workflow
      const workflowResponse = await axios.post(`${API}/workflows`, {
        name: workflowName,
        description: workflowDescription
      });

      const workflowId = workflowResponse.data.id;

      // Create tasks
      for (const task of tasks) {
        await axios.post(`${API}/workflows/${workflowId}/tasks`, task);
      }

      alert('Workflow created successfully!');
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Error creating workflow:', error);
      alert('Error creating workflow');
    }
  };

  const handleAddTask = () => {
    if (currentTask.title && currentTask.assignee_id && currentTask.approver_id) {
      setTasks([...tasks, { ...currentTask, id: Date.now().toString() }]);
      setCurrentTask({
        title: '',
        description: '',
        assignee_id: '',
        approver_id: '',
        transitions: []
      });
      setShowTaskModal(false);
    }
  };

  if (user?.role !== 'admin') {
    return <div className="flex justify-center items-center h-screen bg-gray-100">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="text-blue-600 hover:text-blue-800 mr-4"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Create Workflow</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter workflow name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Describe the workflow"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Tasks</h3>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
                  >
                    Add Task
                  </button>
                </div>

                <div className="space-y-4">
                  {tasks.map((task, index) => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h4 className="font-medium text-gray-900">{task.title}</h4>
                      <p className="text-gray-600 text-sm mt-1">{task.description}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        Assignee: {users.find(u => u.id === task.assignee_id)?.name || 'Unknown'} |
                        Approver: {users.find(u => u.id === task.approver_id)?.name || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleCreateWorkflow}
                  disabled={!workflowName || tasks.length === 0}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:bg-gray-300"
                >
                  Create Workflow
                </button>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Task</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={currentTask.title}
                  onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={currentTask.description}
                  onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Describe the task"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignee
                </label>
                <select
                  value={currentTask.assignee_id}
                  onChange={(e) => setCurrentTask({ ...currentTask, assignee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select assignee</option>
                  {users.filter(u => u.role === 'assignee').map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approver
                </label>
                <select
                  value={currentTask.approver_id}
                  onChange={(e) => setCurrentTask({ ...currentTask, approver_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select approver</option>
                  {users.filter(u => u.role === 'approver').map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={handleAddTask}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
              >
                Add Task
              </button>
              <button
                onClick={() => setShowTaskModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-200"
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
    return <div className="flex justify-center items-center h-screen bg-gray-100">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="text-blue-600 hover:text-blue-800 mr-4"
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
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    workflow.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
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
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
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