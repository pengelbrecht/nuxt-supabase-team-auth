import { test, expect } from './fixtures'

test.describe('Team Management', () => {
  test('should display team information for authenticated user', async ({
    authenticatedPage,
    testTeam,
  }) => {
    // Navigate to team page or check team info on dashboard
    await authenticatedPage.goto('/team') // Adjust URL as needed

    // Check that team name is displayed
    await expect(authenticatedPage.locator('[data-testid="team-name"]'))
      .toContainText(testTeam.name)

    // Check that user role is displayed
    await expect(authenticatedPage.locator('[data-testid="user-role"]'))
      .toContainText('owner')
  })

  test('should invite a new team member', async ({
    authenticatedPage,
    testTeam,
    supabaseAdmin,
  }) => {
    await authenticatedPage.goto('/team/members') // Adjust URL as needed

    // Click invite member button
    await authenticatedPage.click('[data-testid="invite-member-button"]')

    // Fill in invitation form
    const inviteEmail = `invite-${Date.now()}@example.com`
    await authenticatedPage.fill('[data-testid="invite-email-input"]', inviteEmail)
    await authenticatedPage.selectOption('[data-testid="invite-role-select"]', 'member')

    await authenticatedPage.click('[data-testid="send-invite-button"]')

    // Check for success message
    await expect(authenticatedPage.locator('[data-testid="success-message"]'))
      .toContainText('Invitation sent')

    // Verify invitation was created in database
    const { data: invites } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('email', inviteEmail)
      .eq('team_id', testTeam.id)

    expect(invites).toHaveLength(1)
    expect(invites?.[0].role).toBe('member')

    // Cleanup
    if (invites && invites[0]) {
      await supabaseAdmin.from('invites').delete().eq('id', invites[0].id)
    }
  })

  test('should promote team member to admin', async ({
    authenticatedPage,
    testTeam,
    supabaseAdmin,
    testUser,
  }) => {
    // First create another user to promote
    const { data: memberUser } = await supabaseAdmin.auth.admin.createUser({
      email: `member-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    })

    if (!memberUser.user) throw new Error('Failed to create member user')

    // Add them to the team as a member
    await supabaseAdmin.from('team_members').insert({
      team_id: testTeam.id,
      user_id: memberUser.user.id,
      role: 'member',
    })

    await authenticatedPage.goto('/team/members')

    // Find the member row and click promote button
    const memberRow = authenticatedPage.locator(`[data-testid="member-row-${memberUser.user.id}"]`)
    await memberRow.locator('[data-testid="promote-button"]').click()

    // Confirm promotion
    await authenticatedPage.click('[data-testid="confirm-promote-button"]')

    // Check for success message
    await expect(authenticatedPage.locator('[data-testid="success-message"]'))
      .toContainText('Member promoted')

    // Verify role change in database
    const { data: updatedMember } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', testTeam.id)
      .eq('user_id', memberUser.user.id)
      .single()

    expect(updatedMember?.role).toBe('admin')

    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(memberUser.user.id)
  })

  test('should transfer team ownership', async ({
    authenticatedPage,
    testTeam,
    supabaseAdmin,
    testUser,
  }) => {
    // Create another admin user to transfer ownership to
    const { data: adminUser } = await supabaseAdmin.auth.admin.createUser({
      email: `admin-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    })

    if (!adminUser.user) throw new Error('Failed to create admin user')

    // Add them as admin
    await supabaseAdmin.from('team_members').insert({
      team_id: testTeam.id,
      user_id: adminUser.user.id,
      role: 'admin',
    })

    await authenticatedPage.goto('/team/settings')

    // Click transfer ownership button
    await authenticatedPage.click('[data-testid="transfer-ownership-button"]')

    // Select the admin user
    await authenticatedPage.selectOption('[data-testid="new-owner-select"]', adminUser.user.id)

    // Confirm transfer
    await authenticatedPage.fill('[data-testid="confirm-transfer-input"]', 'TRANSFER')
    await authenticatedPage.click('[data-testid="confirm-transfer-button"]')

    // Check for success message
    await expect(authenticatedPage.locator('[data-testid="success-message"]'))
      .toContainText('Ownership transferred')

    // Verify ownership change in database
    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', testTeam.id)
      .in('user_id', [testUser.id, adminUser.user.id])

    const originalOwner = members?.find(m => m.user_id === testUser.id)
    const newOwner = members?.find(m => m.user_id === adminUser.user.id)

    expect(originalOwner?.role).toBe('admin')
    expect(newOwner?.role).toBe('owner')

    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(adminUser.user.id)
  })

  test('should delete team (owner only)', async ({
    authenticatedPage,
    testTeam,
    supabaseAdmin,
  }) => {
    await authenticatedPage.goto('/team/settings')

    // Click delete team button
    await authenticatedPage.click('[data-testid="delete-team-button"]')

    // Confirm deletion
    await authenticatedPage.fill('[data-testid="confirm-delete-input"]', testTeam.name)
    await authenticatedPage.click('[data-testid="confirm-delete-button"]')

    // Should redirect after deletion
    await expect(authenticatedPage.locator('[data-testid="no-team-message"]'))
      .toBeVisible()

    // Verify team was deleted from database
    const { data: deletedTeam } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', testTeam.id)

    expect(deletedTeam).toHaveLength(0)
  })
})
