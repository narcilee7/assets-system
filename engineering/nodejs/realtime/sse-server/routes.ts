import { Router } from 'express';
import { sseService } from './sse-server';

const router = Router();

router.get('/events', (req, res) => sseService.subscribe(req, res));

router.post('/notify', (req, res) => {
  sseService.broadcast('notification', req.body);
  res.json({ ok: true });
});

export default router;
