const express = require('express');
const db      = require('../config/db');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);   // All task routes require login

// ── GET /api/tasks ──────────────────────────────────────────────────────────
// ?search=keyword  ?sort=newest|oldest  ?filter=all|active|completed
router.get('/', async (req, res) => {
  try {
    const { search, sort, filter } = req.query;

    let query  = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [req.user.id];

    if (filter === 'active')    query += ' AND is_completed = 0';
    if (filter === 'completed') query += ' AND is_completed = 1';

    if (search && search.trim()) {
      query += ' AND title LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    query += sort === 'oldest' ? ' ORDER BY created_at ASC' : ' ORDER BY created_at DESC';

    const [tasks] = await db.query(query, params);
    res.json({ tasks });

  } catch (err) {
    console.error('GET /tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// ── POST /api/tasks ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { title } = req.body;

  if (!title || !title.trim())
    return res.status(400).json({ error: 'Task title is required.' });

  const safeTitle = title.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');

  try {
    const [result] = await db.query(
      'INSERT INTO tasks (user_id, title) VALUES (?, ?)',
      [req.user.id, safeTitle]
    );
    const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Task created!', task: rows[0] });

  } catch (err) {
    console.error('POST /tasks error:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// ── PUT /api/tasks/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { title, is_completed } = req.body;

  try {
    const [rows] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Task not found.' });

    const existing     = rows[0];
    const newTitle     = title !== undefined
      ? title.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : existing.title;
    const newCompleted = is_completed !== undefined ? (is_completed ? 1 : 0) : existing.is_completed;

    await db.query(
      'UPDATE tasks SET title = ?, is_completed = ? WHERE id = ?',
      [newTitle, newCompleted, taskId]
    );

    const [updated] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.json({ message: 'Task updated!', task: updated[0] });

  } catch (err) {
    console.error('PUT /tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// ── DELETE /api/tasks/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id);

  try {
    const [rows] = await db.query(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Task not found.' });

    await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.json({ message: 'Task deleted successfully.' });

  } catch (err) {
    console.error('DELETE /tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

module.exports = router;