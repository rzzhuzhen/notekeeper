import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import './App.css'

interface Note {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

interface User {
  id: string
  email: string
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [authView, setAuthView] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (supabaseUser) {
      setUser({ id: supabaseUser.id, email: supabaseUser.email || '' })
      fetchNotes()
    } else {
      setLoading(false)
    }
  }

  async function fetchNotes() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) {
      setNotes(data || [])
    }
    setLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      setError(error.message)
    } else {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser()
      if (supabaseUser) {
        setUser({ id: supabaseUser.id, email: supabaseUser.email || '' })
        fetchNotes()
      }
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    })

    if (error) {
      setError(error.message)
    } else {
      alert('注册成功！请查收验证邮件。')
      setAuthView('login')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setNotes([])
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    const { error } = await supabase
      .from('notes')
      .insert({
        title,
        content,
        user_id: supabaseUser.id
      })

    if (error) {
      alert('保存失败: ' + error.message)
      return
    }

    setTitle('')
    setContent('')
    setView('list')
    fetchNotes()
  }

  async function handleUpdateNote(e: React.FormEvent) {
    e.preventDefault()
    if (!currentNote) return

    const { error } = await supabase
      .from('notes')
      .update({
        title,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentNote.id)

    if (!error) {
      setTitle('')
      setContent('')
      setCurrentNote(null)
      setView('list')
      fetchNotes()
    }
  }

  function startCreate() {
    setTitle('')
    setContent('')
    setView('create')
  }

  function startEdit(note: Note) {
    setCurrentNote(note)
    setTitle(note.title)
    setContent(note.content)
    setView('edit')
  }

  async function deleteNote(note: Note) {
    if (!confirm('确定要删除这条笔记吗？')) return

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', note.id)

    if (!error) {
      fetchNotes()
    }
  }

  // Auth Form
  if (!user) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl justify-center mb-4">NoteKeeper</h2>

            <div className="tabs tabs-boxed mb-4">
              <button
                className={`tab ${authView === 'login' ? 'tab-active' : ''}`}
                onClick={() => setAuthView('login')}
              >
                登录
              </button>
              <button
                className={`tab ${authView === 'signup' ? 'tab-active' : ''}`}
                onClick={() => setAuthView('signup')}
              >
                注册
              </button>
            </div>

            {authView === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="email"
                  placeholder="邮箱"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="input input-bordered w-full"
                  required
                />
                <input
                  type="password"
                  placeholder="密码"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="input input-bordered w-full"
                  required
                />
                {error && <div className="alert alert-error">{error}</div>}
                <button type="submit" className="btn btn-primary w-full">
                  登录
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <input
                  type="email"
                  placeholder="邮箱"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="input input-bordered w-full"
                  required
                />
                <input
                  type="password"
                  placeholder="密码（至少6位）"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="input input-bordered w-full"
                  required
                  minLength={6}
                />
                {error && <div className="alert alert-error">{error}</div>}
                <button type="submit" className="btn btn-primary w-full">
                  注册
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Notes List
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="navbar bg-base-100 shadow-sm">
          <div className="flex-1">
            <a className="btn btn-ghost text-xl">NoteKeeper</a>
          </div>
          <div className="flex-none gap-2">
            <span className="text-sm opacity-70">{user.email}</span>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              退出
            </button>
          </div>
        </div>

        <div className="container mx-auto p-4 max-w-3xl">
          <button onClick={startCreate} className="btn btn-primary w-full mb-6">
            + 新建笔记
          </button>

          {loading ? (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center p-8 text-base-content/60">
              <p>暂无笔记，点击上方按钮创建</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="card-body">
                    <h3 className="card-title text-lg">{note.title}</h3>
                    <p className="text-base-content/70 line-clamp-3">
                      {note.content || '无内容'}
                    </p>
                    <div className="card-actions justify-between items-center mt-2">
                      <span className="text-xs text-base-content/50">
                        {new Date(note.created_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(note)}
                          className="btn btn-ghost btn-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => deleteNote(note)}
                          className="btn btn-ghost btn-sm text-error"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Create Note
  if (view === 'create') {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="navbar bg-base-100 shadow-sm">
          <div className="flex-1">
            <button onClick={() => setView('list')} className="btn btn-ghost">
              ← 返回
            </button>
          </div>
          <div className="flex-none">
            <span className="text-xl font-medium">新建笔记</span>
          </div>
        </div>

        <div className="container mx-auto p-4 max-w-3xl">
          <form onSubmit={handleCreateNote} className="space-y-4">
            <input
              type="text"
              placeholder="笔记标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input input-bordered w-full text-lg"
              required
              autoFocus
            />
            <textarea
              placeholder="写下你的想法..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="textarea textarea-bordered w-full h-64"
            />
            <button type="submit" className="btn btn-primary">
              保存笔记
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Edit Note
  if (view === 'edit') {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="navbar bg-base-100 shadow-sm">
          <div className="flex-1">
            <button onClick={() => setView('list')} className="btn btn-ghost">
              ← 返回
            </button>
          </div>
          <div className="flex-none">
            <span className="text-xl font-medium">编辑笔记</span>
          </div>
        </div>

        <div className="container mx-auto p-4 max-w-3xl">
          <form onSubmit={handleUpdateNote} className="space-y-4">
            <input
              type="text"
              placeholder="笔记标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input input-bordered w-full text-lg"
              required
              autoFocus
            />
            <textarea
              placeholder="写下你的想法..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="textarea textarea-bordered w-full h-64"
            />
            <button type="submit" className="btn btn-primary">
              更新笔记
            </button>
          </form>
        </div>
      </div>
    )
  }
}