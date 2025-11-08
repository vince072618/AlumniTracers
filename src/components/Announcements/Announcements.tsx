import React from 'react'
import { supabase } from '../../lib/supabase'
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Stack,
  LinearProgress,
  Alert
} from '@mui/material'

type Ann = {
  id: string
  title: string
  body: string
  audience: string
  published_at: string | null
  created_at: string
  image_url?: string | null
}

function fmtDate(d?: string | null) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return d || ''
  }
}

export default function Announcements() {
  const [rows, setRows] = React.useState<Ann[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,body,audience,published_at,created_at,image_url')
        .eq('published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
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
    return () => { supabase.removeChannel(ch) }
  }, [load])

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Announcements</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <LinearProgress />}

      <Stack spacing={2}>
        {rows.map(a => (
          <Card key={a.id} variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1 }}>
              {/* Media first on mobile, right panel on desktop */}
              <Box
                sx={{
                  order: { xs: 0, md: 1 },
                  flex: { md: '0 0 260px' },
                  width: { xs: '100%', md: 260 },
                  p: { xs: 0, md: 1 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: { xs: 'auto', md: 140 },
                    position: 'relative',
                    pt: { xs: '56.25%', md: 0 },
                    borderRadius: { xs: 0, md: 1 },
                    overflow: 'hidden',
                    bgcolor: a.image_url ? 'transparent' : 'action.hover'
                  }}
                >
                  {a.image_url && (
                    <CardMedia
                      component="img"
                      loading="lazy"
                      image={a.image_url}
                      alt={a.title || ''}
                      sx={{
                        position: { xs: 'absolute', md: 'static' },
                        top: { xs: 0, md: 'auto' },
                        left: { xs: 0, md: 'auto' },
                        width: '100%',
                        height: { xs: '100%', md: 140 },
                        objectFit: 'cover',
                        objectPosition: 'center'
                      }}
                    />
                  )}
                </Box>
              </Box>

              {/* Content below image on mobile, left on desktop */}
              <CardContent sx={{ flex: '1 1 auto', minWidth: 0, order: { xs: 1, md: 0 } }}>
                <Stack spacing={0.5}>
                  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                    {fmtDate(a.published_at || a.created_at)}
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {a.title}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      display: { xs: '-webkit-box', md: 'block' },
                      WebkitLineClamp: { xs: 6, md: 'unset' },
                      WebkitBoxOrient: { xs: 'vertical', md: 'initial' },
                      overflow: { xs: 'hidden', md: 'visible' }
                    }}
                  >
                    {a.body}
                  </Typography>
                </Stack>
              </CardContent>
            </Box>
          </Card>
        ))}
      </Stack>

      {!loading && rows.length === 0 && (
        <Typography color="text.secondary">No announcements.</Typography>
      )}
    </Stack>
  )
}
