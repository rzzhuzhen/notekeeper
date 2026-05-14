import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../utils/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

interface Note {
  id: string
  title: string
  content: string
  notebook_id: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
}

interface Notebook {
  id: string
  name: string
  parent_id: string | null
  children?: Notebook[]
  created_at: string
  updated_at: string
}

interface Tag {
  id: string
  name: string
  color: string
}

interface User {
  id: string
  email: string
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'preview'>('list')
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [authView, setAuthView] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [newNotebookName, setNewNotebookName] = useState('')
  const [showNotebookInput, setShowNotebookInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [selectedNoteTags, setSelectedNoteTags] = useState<string[]>([])

  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (supabaseUser) {
      setUser({ id: supabaseUser.id, email: supabaseUser.email || '' })
      fetchNotebooks()
      fetchTags()
      fetchNotes()
    } else {
      setLoading(false)
    }
  }

  async function fetchNotebooks() {
    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      const tree = buildNotebookTree(data)
      setNotebooks(tree)
    }
  }

  function buildNotebookTree(flatNotebooks: Notebook[]): Notebook[] {
    const notebookMap = new Map<string, Notebook>()
    const roots: Notebook[] = []

    flatNotebooks.forEach(nb => {
      notebookMap.set(nb.id, { ...nb, children: [] })
    })

    flatNotebooks.forEach(nb => {
      const node = notebookMap.get(nb.id)!
      if (nb.parent_id && notebookMap.has(nb.parent_id)) {
        notebookMap.get(nb.parent_id)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  async function fetchTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true })

    if (!error) {
      setTags(data || [])
    }
  }

  async function fetchNotes() {
    const { data, error } = await supabase
      .from('notes')
      .select('*, note_tags(tag_id, tags(*))')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const notesWithTags = data.map((n: any) => ({
        ...n,
        tags: n.note_tags?.map((nt: any) => nt.tags).filter(Boolean) || []
      }))
      setNotes(notesWithTags)
    }
    setLoading(false)
  }

  async function fetchNoteTags(noteId: string): Promise<Tag[]> {
    const { data } = await supabase
      .from('note_tags')
      .select('tags(*)')
      .eq('note_id', noteId)

    return data?.map((nt: any) => nt.tags).filter(Boolean) || []
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
        fetchNotebooks()
        fetchTags()
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
    setNotebooks([])
    setTags([])
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault()
    if (!newTagName.trim()) return

    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    const color = TAG_COLORS[tags.length % TAG_COLORS.length]

    const { error } = await supabase
      .from('tags')
      .insert({
        name: newTagName.trim(),
        user_id: supabaseUser.id,
        color
      })

    if (error) {
      alert('创建失败: ' + error.message)
      return
    }

    setNewTagName('')
    setShowTagInput(false)
    fetchTags()
  }

  async function deleteTag(tagId: string) {
    if (!confirm('确定要删除这个标签吗？')) return

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)

    if (!error) {
      if (selectedTagId === tagId) {
        setSelectedTagId(null)
      }
      fetchTags()
      fetchNotes()
    }
  }

  async function handleCreateNotebook(e: React.FormEvent) {
    e.preventDefault()
    if (!newNotebookName.trim()) return

    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    const { error } = await supabase
      .from('notebooks')
      .insert({
        name: newNotebookName,
        user_id: supabaseUser.id,
        parent_id: selectedNotebookId
      })

    if (error) {
      alert('创建失败: ' + error.message)
      return
    }

    setNewNotebookName('')
    setShowNotebookInput(false)
    fetchNotebooks()
  }

  async function deleteNotebook(notebookId: string) {
    if (!confirm('确定要删除这个笔记本吗？')) return

    const { error } = await supabase
      .from('notebooks')
      .delete()
      .eq('id', notebookId)

    if (!error) {
      if (selectedNotebookId === notebookId) {
        setSelectedNotebookId(null)
      }
      fetchNotebooks()
      fetchNotes()
    }
  }

  async function moveNoteToNotebook(noteId: string, notebookId: string | null) {
    const { error } = await supabase
      .from('notes')
      .update({ notebook_id: notebookId, updated_at: new Date().toISOString() })
      .eq('id', noteId)

    if (!error) {
      fetchNotes()
    }
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) return

    const { data: noteData, error } = await supabase
      .from('notes')
      .insert({
        title,
        content,
        user_id: supabaseUser.id,
        notebook_id: selectedNotebookId
      })
      .select()
      .single()

    if (error) {
      alert('保存失败: ' + error.message)
      return
    }

    if (selectedNoteTags.length > 0 && noteData) {
      const tagInserts = selectedNoteTags.map(tagId => ({
        note_id: noteData.id,
        tag_id: tagId
      }))
      await supabase.from('note_tags').insert(tagInserts)
    }

    setTitle('')
    setContent('')
    setSelectedNoteTags([])
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
        notebook_id: selectedNotebookId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentNote.id)

    if (error) {
      alert('更新失败: ' + error.message)
      return
    }

    await supabase.from('note_tags').delete().eq('note_id', currentNote.id)

    if (selectedNoteTags.length > 0) {
      const tagInserts = selectedNoteTags.map(tagId => ({
        note_id: currentNote.id,
        tag_id: tagId
      }))
      await supabase.from('note_tags').insert(tagInserts)
    }

    setTitle('')
    setContent('')
    setSelectedNoteTags([])
    setCurrentNote(null)
    setView('list')
    fetchNotes()
  }

  function startCreate() {
    setTitle('')
    setContent('')
    setSelectedNoteTags([])
    setView('create')
  }

  async function startEdit(note: Note) {
    setCurrentNote(note)
    setTitle(note.title)
    setContent(note.content)
    setSelectedNotebookId(note.notebook_id)
    const noteTags = await fetchNoteTags(note.id)
    setSelectedNoteTags(noteTags.map(t => t.id))
    setView('edit')
  }

  function startPreview(note: Note) {
    setCurrentNote(note)
    setView('preview')
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

  function selectNotebook(id: string | null) {
    setSelectedNotebookId(id)
  }

  function toggleTagForNote(tagId: string) {
    setSelectedNoteTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const renderNotebookTree = useCallback((nodes: Notebook[], depth = 0): React.ReactNode => {
    return nodes.map(node => (
      <div key={node.id} className="group">
        <div
          className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-base-300 ${
            selectedNotebookId === node.id ? 'bg-primary/20' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => selectNotebook(node.id)}
          >
            <span className="text-sm">📁</span>
            <span className="truncate text-sm">{node.name}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNotebook(node.id) }}
            className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 hover:text-error"
            title="删除笔记本"
          >
            ✕
          </button>
        </div>
        {node.children && node.children.length > 0 && renderNotebookTree(node.children, depth + 1)}
      </div>
    ))
  }, [selectedNotebookId])

  function renderNotebookMoveOptions(nodes: Notebook[], noteId: string, depth: number): React.ReactNode {
    return nodes.map(node => (
      <li key={node.id}>
        <a onClick={() => moveNoteToNotebook(noteId, node.id)}>
          {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{node.name}
        </a>
        {node.children && node.children.length > 0 && (
          <ul>{renderNotebookMoveOptions(node.children, noteId, depth + 1)}</ul>
        )}
      </li>
    ))
  }

  let filteredNotes = notes
  if (selectedNotebookId) {
    filteredNotes = filteredNotes.filter(n => n.notebook_id === selectedNotebookId)
  }
  if (selectedTagId) {
    filteredNotes = filteredNotes.filter(n => n.tags?.some(t => t.id === selectedTagId))
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
      <div className="min-h-screen bg-base-200 flex">
        {/* 侧边栏 */}
        <div className="w-64 bg-base-100 border-r border-base-300 flex flex-col">
          <div className="p-4 border-b border-base-300 flex-1 overflow-y-auto">
            <div className="font-semibold text-lg mb-3">笔记本</div>

            {/* 全部笔记 */}
            <div
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-300 ${
                selectedNotebookId === null ? 'bg-primary/20' : ''
              }`}
              onClick={() => selectNotebook(null)}
            >
              <span className="text-sm">📚</span>
              <span className="text-sm">全部笔记</span>
              <span className="text-xs text-base-content/50 ml-auto">{notes.length}</span>
            </div>

            {/* 笔记本树 */}
            <div className="mt-2 max-h-[200px] overflow-y-auto">
              {notebooks.map(node => (
                <div key={node.id} className="group">
                  {renderNotebookTree([node])}
                </div>
              ))}
            </div>

            {/* 新建笔记本 */}
            {showNotebookInput ? (
              <form onSubmit={handleCreateNotebook} className="mt-2 flex gap-1">
                <input
                  type="text"
                  placeholder="笔记本名"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  className="input input-bordered input-sm flex-1"
                  autoFocus
                />
                <button type="submit" className="btn btn-sm btn-primary">✓</button>
                <button type="button" onClick={() => setShowNotebookInput(false)} className="btn btn-sm btn-ghost">✕</button>
              </form>
            ) : (
              <button
                onClick={() => setShowNotebookInput(true)}
                className="btn btn-ghost btn-sm mt-2 w-full"
              >
                + 新建笔记本
              </button>
            )}
          </div>

          {/* 标签区域 */}
          <div className="p-4 border-t border-base-300">
            <div className="font-semibold text-lg mb-3">标签</div>

            {/* 全部标签选项 */}
            <div
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-300 ${
                selectedTagId === null ? 'bg-primary/20' : ''
              }`}
              onClick={() => setSelectedTagId(null)}
            >
              <span className="text-sm">🏷️</span>
              <span className="text-sm">全部标签</span>
            </div>

            {/* 标签列表 */}
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map(tag => (
                <div
                  key={tag.id}
                  className={`group flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer ${
                    selectedTagId === tag.id ? 'ring-2 ring-offset-1' : 'hover:opacity-80'
                  }`}
                  style={{ backgroundColor: tag.color + '30', color: tag.color }}
                  onClick={() => setSelectedTagId(tag.id)}
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTag(tag.id) }}
                    className="opacity-0 group-hover:opacity-100 text-xs hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* 新建标签 */}
            {showTagInput ? (
              <form onSubmit={handleCreateTag} className="mt-2 flex gap-1">
                <input
                  type="text"
                  placeholder="标签名"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="input input-bordered input-sm flex-1"
                  autoFocus
                />
                <button type="submit" className="btn btn-sm btn-primary">✓</button>
                <button type="button" onClick={() => setShowTagInput(false)} className="btn btn-sm btn-ghost">✕</button>
              </form>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="btn btn-ghost btn-sm mt-2 w-full"
              >
                + 新建标签
              </button>
            )}
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col">
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

          <div className="container mx-auto p-4 max-w-3xl flex-1">
            <button onClick={startCreate} className="btn btn-primary w-full mb-6">
              + 新建笔记
            </button>

            {loading ? (
              <div className="flex justify-center p-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center p-8 text-base-content/60">
                <p>暂无笔记</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotes.map((note) => (
                  <div key={note.id} className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="card-body">
                      <h3 className="card-title text-lg">{note.title}</h3>
                      <div className="text-base-content/70 line-clamp-3 prose prose-sm max-w-none">
                        {note.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content.slice(0, 200)}</ReactMarkdown>
                        ) : (
                          <span className="opacity-50">无内容</span>
                        )}
                      </div>

                      {/* 标签显示 */}
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {note.tags.map(tag => (
                            <span
                              key={tag.id}
                              className="badge text-xs"
                              style={{ backgroundColor: tag.color + '30', color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="card-actions justify-between items-center mt-2">
                        <span className="text-xs text-base-content/50">
                          {new Date(note.created_at).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        <div className="flex gap-2">
                          <div className="dropdown dropdown-end">
                            <label tabIndex={0} className="btn btn-ghost btn-sm">移动 ▼</label>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                              <li><a onClick={() => moveNoteToNotebook(note.id, null)}>移至全部笔记</a></li>
                              {renderNotebookMoveOptions(notebooks, note.id, 0)}
                            </ul>
                          </div>
                          <button
                            onClick={() => startPreview(note)}
                            className="btn btn-ghost btn-sm"
                          >
                            预览
                          </button>
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

        <div className="container mx-auto p-4 max-w-4xl">
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

            {/* 标签选择 */}
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagForNote(tag.id)}
                  className={`badge cursor-pointer transition-all ${
                    selectedNoteTags.includes(tag.id) ? 'ring-2 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: tag.color + '30', color: tag.color, borderColor: tag.color }}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            {/* 标签选择 */}
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagForNote(tag.id)}
                  className={`badge cursor-pointer transition-all ${
                    selectedNoteTags.includes(tag.id) ? 'ring-2 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: tag.color + '30', color: tag.color, borderColor: tag.color }}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            {/* Markdown 编辑器 - 双栏 */}
            <div className="flex gap-4 h-96">
              <div className="flex-1">
                <label className="label"><span className="label-text">编辑</span></label>
                <textarea
                  placeholder="写下你的想法... (支持 Markdown)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="textarea textarea-bordered w-full h-full font-mono text-sm"
                />
              </div>
              <div className="flex-1 border border-base-300 rounded-lg p-4 overflow-y-auto bg-base-100">
                <label className="label"><span className="label-text">预览</span></label>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '*无内容*'}</ReactMarkdown>
                </div>
              </div>
            </div>

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

        <div className="container mx-auto p-4 max-w-4xl">
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

            {/* 标签选择 */}
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagForNote(tag.id)}
                  className={`badge cursor-pointer transition-all ${
                    selectedNoteTags.includes(tag.id) ? 'ring-2 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: tag.color + '30', color: tag.color, borderColor: tag.color }}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            {/* Markdown 编辑器 - 双栏 */}
            <div className="flex gap-4 h-96">
              <div className="flex-1">
                <label className="label"><span className="label-text">编辑</span></label>
                <textarea
                  placeholder="写下你的想法... (支持 Markdown)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="textarea textarea-bordered w-full h-full font-mono text-sm"
                />
              </div>
              <div className="flex-1 border border-base-300 rounded-lg p-4 overflow-y-auto bg-base-100">
                <label className="label"><span className="label-text">预览</span></label>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '*无内容*'}</ReactMarkdown>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              更新笔记
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Preview Note
  if (view === 'preview' && currentNote) {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="navbar bg-base-100 shadow-sm">
          <div className="flex-1">
            <button onClick={() => setView('list')} className="btn btn-ghost">
              ← 返回
            </button>
          </div>
          <div className="flex-none">
            <span className="text-xl font-medium">预览</span>
          </div>
        </div>

        <div className="container mx-auto p-4 max-w-4xl">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h1 className="card-title text-2xl mb-4">{currentNote.title}</h1>

              {/* 标签显示 */}
              {currentNote.tags && currentNote.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {currentNote.tags.map(tag => (
                    <span
                      key={tag.id}
                      className="badge"
                      style={{ backgroundColor: tag.color + '30', color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="divider my-2"></div>

              <div className="prose prose-lg max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentNote.content || '*无内容*'}
                </ReactMarkdown>
              </div>

              <div className="divider my-2"></div>

              <div className="text-xs text-base-content/50">
                创建于 {new Date(currentNote.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}