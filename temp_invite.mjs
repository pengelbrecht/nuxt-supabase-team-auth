import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
)

// Send invitation
const { data, error } = await supabase.auth.admin.inviteUserByEmail(
  'testinvite@example.com',
  {
    data: {
      team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      team_name: 'Test Team',
      role: 'member',
    },
  },
)

if (error) {
  console.error('Invitation failed:', error)
}
else {
  console.log('Invitation sent successfully')
  console.log('Invitation link (for testing):', data.user.confirmation_sent_at)
}
