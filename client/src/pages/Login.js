import React, { useState } from 'react';
import API, { setAuthToken } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import '../styles.css';

export default function Login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('userName', user.name);
      setAuthToken(token);
      nav('/chat');
    } catch (err) {
      alert(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-center">
      <div className="card">
        <div className="brand">Chat</div>
        <div className="small">Sign in to continue</div>

        <form style={{marginTop:16}} onSubmit={login}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required />
          </div>

          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
            <Link to="/register" className="link">Create account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
