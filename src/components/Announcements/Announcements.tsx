import React from 'react'
import { Card, CardContent, Typography, Stack, LinearProgress, Alert } from '@mui/material'
import { supabase } from '../../lib/supabase'

type Ann = {
  id: string
  title: string
  body: string
  audience: string
  published_at: string | null
  created_at: string
}

function fmt(d?: string | null) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return d as string
  }
}

export default function Announcements() {
  const [rows, setRows] = React.useState<Ann[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,body,audience,published_at,created_at')
        .eq('published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(200)
      if (error) throw error
      setRows((data ?? []) as Ann[])
    } catch (e: any) {
      setError(e.message || 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
    const ch = supabase
      .channel('announcements-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [load])

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Announcements</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <LinearProgress />}

      {rows.map(row => (
        <Card key={row.id} variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={700}>{row.title}</Typography>
            <Typography variant="caption" color="text.secondary">{fmt(row.published_at || row.created_at)}</Typography>
            <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{row.body}</Typography>
          </CardContent>
        </Card>
      ))}

      {!loading && rows.length === 0 && (
        <Typography color="text.secondary">No announcements.</Typography>
      )}
    </Stack>
  )
}
