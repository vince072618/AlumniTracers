import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { supabase } from '../lib/supabase'

export default function NotAlumniNotice() {
  const toDeletion = () => { try { window.location.href = '/request-deletion' } catch {} }
  const logout = async () => { try { await supabase.auth.signOut(); } catch {} try { window.location.href = '/' } catch {} }

  return (
    <Dialog open fullWidth maxWidth="sm">
      <DialogTitle>Notice</DialogTitle>
      <DialogContent>
        <Typography sx={{ whiteSpace: 'pre-line' }}>
{`Thank you for registering. However, this platform is intended only for alumni of NBSC (formerly NBCC).

Please proceed to request account deletion.

Thank you.`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" onClick={toDeletion}>
          Proceed to Request Account Deletion
        </Button>
        <Button variant="outlined" onClick={logout}>
          Logout
        </Button>
      </DialogActions>
    </Dialog>
  )
}
