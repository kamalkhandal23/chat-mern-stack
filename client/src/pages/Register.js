import React, { useState } from 'react';
import API, { setAuthToken } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import '../styles.css';

export default function Register(){
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const register = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post('/auth/register', { name, email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('userName', user.name);
      setAuthToken(token);
      nav('/chat');
    } catch (err) {
      alert(err.response?.data?.message || 'Register failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-center">
      <div className="card">
        <div className="brand">Chat — Create account</div>
        <div className="small">Create your account to start chatting</div>

        <form style={{marginTop:16}} onSubmit={register}>
          <div className="form-group">
            <label>Full name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choose a password" required />
            <div className="small" style={{marginTop:6}}>Use a strong password (min 8 chars).</div>
          </div>

          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
            <Link to="/login" className="link">Already have an account?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
