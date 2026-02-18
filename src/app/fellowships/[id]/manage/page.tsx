'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import MemberInviteModal from '@/components/MemberInviteModal'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  Settings, 
  Megaphone, 
  BarChart3, 
  UserPlus,
  MessageCircle,
  Crown,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Heart,
  BookOpen,
  Edit3,
  Trash2,
  MoreVertical,
  Filter,
  Search,
  Plus,
  Mail,
  Phone,
  MoreHorizontal,
  TrendingUp
} from 'lucide-react'

export default function FellowshipManagePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string>('')
  const [creatingInvite, setCreatingInvite] = useState(false)

  // Mock fellowship data
  const fellowshipData = {
    id: params.id,
    name: 'Young Adults Bible Study',
    description: 'A vibrant community of young adults exploring God\'s word together through study, prayer, and fellowship.',
    category: 'Bible Study',
    location: 'Downtown Community Center, Room 101',
    meetingDay: 'Wednesday',
    meetingTime: '7:00 PM',
    meetingFrequency: 'weekly',
    maxMembers: 25,
    currentMembers: 18,
    privacy: 'public',
    joiningRules: 'approval_required',
    tags: ['Bible Study', 'Young Adults', 'Community', 'Prayer'],
    stats: {
      totalMembers: 18,
      activeMembers: 15,
      eventsHosted: 12,
      engagementRate: 89,
      avgAttendance: 14
    },
    members: [
      {
        id: '1',
        name: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        role: 'member',
        joinDate: '2024-01-15',
        lastActive: '2 hours ago',
        attendance: 95,
        status: 'active',
        avatar: null
      },
      {
        id: '2',
        name: 'Mike Chen',
        email: 'mike.c@email.com',
        role: 'co-leader',
        joinDate: '2024-01-10',
        lastActive: '1 hour ago',
        attendance: 100,
        status: 'active',
        avatar: null
      },
      {
        id: '3',
        name: 'Emily Rodriguez',
        email: 'emily.r@email.com',
        role: 'member',
        joinDate: '2024-01-20',
        lastActive: '1 day ago',
        attendance: 78,
        status: 'active',
        avatar: null
      },
      {
        id: '4',
        name: 'David Thompson',
        email: 'david.t@email.com',
        role: 'member',
        joinDate: '2024-01-25',
        lastActive: '3 days ago',
        attendance: 60,
        status: 'pending',
        avatar: null
      }
    ],
    pendingInvites: [
      {
        id: '1',
        email: 'john.doe@email.com',
        invitedBy: 'Sarah Johnson',
        invitedDate: '2024-01-26',
        status: 'pending'
      },
      {
        id: '2',
        email: 'jane.smith@email.com',
        invitedBy: 'Mike Chen',
        invitedDate: '2024-01-27',
        status: 'pending'
      }
    ],
    recentEvents: [
      {
        id: '1',
        title: 'Bible Study - Book of Romans',
        date: '2024-01-24',
        attendees: 14,
        maxAttendees: 25,
        status: 'completed'
      },
      {
        id: '2',
        title: 'Prayer Meeting',
        date: '2024-01-17',
        attendees: 12,
        maxAttendees: 25,
        status: 'completed'
      },
      {
        id: '3',
        title: 'Community Service Day',
        date: '2024-01-31',
        attendees: 0,
        maxAttendees: 20,
        status: 'upcoming'
      }
    ],
    announcements: [
      {
        id: '1',
        title: 'Welcome New Members!',
        content: 'We\'re excited to welcome our new members to the fellowship. Please introduce yourselves!',
        author: 'Sarah Johnson',
        date: '2024-01-25',
        readCount: 15
      },
      {
        id: '2',
        title: 'Upcoming Community Service',
        content: 'Join us this Saturday for our monthly community service at the local shelter.',
        author: 'Mike Chen',
        date: '2024-01-23',
        readCount: 12
      }
    ]
  }

  const handleInviteMembers = () => {
    setShowInviteModal(true)
  }

  const handleCreateInvite = async () => {
    setCreatingInvite(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !user) {
        throw new Error('Please log in to create invites')
      }

      const response = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          invite_type: 'group',
          group_id: params.id,
        }),
      })

      if (response.status === 403) {
        toast({
          title: 'You need to join this group before inviting others.',
          variant: 'error',
        })
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create invite')
      }

      const data = await response.json()
      const url = data?.inviteUrl || data?.invite?.invite_url
      if (url) {
        setInviteUrl(url)
      }
    } catch (error: any) {
      console.error('Error creating invite:', error)
      toast({
        title: 'Failed to create invite',
        description: error.message || 'Please try again',
        variant: 'error',
      })
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleEditFellowship = () => {
    router.push(`/fellowships/${params.id}/edit`)
  }

  const handleMemberAction = (memberId: string, action: string) => {
    console.log(`${action} member ${memberId}`)
    // In real app, this would make API calls
  }

  const handleEventAction = (eventId: string, action: string) => {
    console.log(`${action} event ${eventId}`)
    // In real app, this would make API calls
  }

  const handleScheduleEvent = () => {
    router.push('/events/create')
  }

  const handleSendAnnouncement = () => {
    router.push('/announcements/create')
  }

  const handleGroupChat = () => {
    router.push(`/fellowships/${params.id}/chat`)
  }

  const filteredMembers = fellowshipData.members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-[#0F1433] pb-20">
      {/* Header */}
      <div className="bg-[#0F1433] shadow-sm border-b border-[#D4AF37]/30 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            
            <div className="flex items-center space-x-3">
              <Logo size="sm" showText={false} />
              <h1 className="text-lg font-bold text-white">Manage Fellowship</h1>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleEditFellowship}
                className="p-2 text-white/60 hover:text-white transition-colors"
                title="Edit Fellowship"
              >
                <Edit3 className="w-5 h-5" />
              </button>
              <button className="p-2 text-white/60 hover:text-white transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fellowship Header */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-gradient-to-r from-[#D4AF37] to-[#F5C451] rounded-2xl p-6 text-[#0F1433] relative overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/20 to-transparent pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-[#0F1433] rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#F5C451]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{fellowshipData.name}</h2>
                <p className="text-[#0F1433]/80">{fellowshipData.category}</p>
              </div>
            </div>
            <p className="text-[#0F1433]/90 mb-4">{fellowshipData.description}</p>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>{fellowshipData.location}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{fellowshipData.meetingDay}s at {fellowshipData.meetingTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 border border-[#D4AF37] rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-[#F5C451]">{fellowshipData.stats.totalMembers}</div>
              <div className="text-sm text-white/80">Total Members</div>
            </div>
          </div>
          <div className="bg-white/5 border border-[#D4AF37] rounded-xl p-4 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-[#F5C451]">{fellowshipData.stats.engagementRate}%</div>
              <div className="text-sm text-white/80">Engagement</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-white/5 rounded-xl p-1">
          {tabs.map(tab => {
            const IconComponent = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#F5C451] text-[#0F1433]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/5 border border-[#D4AF37] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleInviteMembers}
                    className="bg-[#F5C451] text-[#0F1433] p-3 rounded-lg hover:bg-[#D4AF37] transition-colors flex items-center space-x-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="text-sm font-semibold">Invite Members</span>
                  </button>
                  <button
                    onClick={handleScheduleEvent}
                    className="bg-white/10 text-white p-3 rounded-lg hover:bg-white/20 transition-colors border border-[#D4AF37]/50 flex items-center space-x-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-semibold">Schedule Event</span>
                  </button>
                  <button
                    onClick={handleSendAnnouncement}
                    className="bg-white/10 text-white p-3 rounded-lg hover:bg-white/20 transition-colors border border-[#D4AF37]/50 flex items-center space-x-2"
                  >
                    <Megaphone className="w-4 h-4" />
                    <span className="text-sm font-semibold">Send Announcement</span>
                  </button>
                  <button
                    onClick={handleGroupChat}
                    className="bg-white/10 text-white p-3 rounded-lg hover:bg-white/20 transition-colors border border-[#D4AF37]/50 flex items-center space-x-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold">Group Chat</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/5 border border-[#D4AF37] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-white">Emily Rodriguez joined the fellowship</div>
                      <div className="text-xs text-white/60">2 hours ago</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-white">Bible Study event completed</div>
                      <div className="text-xs text-white/60">1 day ago</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <Heart className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-white">Sarah Johnson shared a prayer request</div>
                      <div className="text-xs text-white/60">3 days ago</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Member Search and Actions */}
            <div className="bg-white/5 border border-[#D4AF37] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Members ({fellowshipData.members.length})</h3>
                  <button
                    onClick={handleInviteMembers}
                    className="bg-[#F5C451] text-[#0F1433] px-4 py-2 rounded-lg font-semibold hover:bg-[#D4AF37] transition-colors flex items-center space-x-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Invite</span>
                  </button>
                </div>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg pl-10 pr-4 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451]"
                  />
                </div>

                {/* Members List */}
                <div className="space-y-3">
                  {filteredMembers.map(member => (
                    <div key={member.id} className="bg-white/5 rounded-xl p-4 border border-[#D4AF37]/30 hover:bg-white/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-[#F5C451] rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-[#0F1433]">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-white">{member.name}</h4>
                              {member.role === 'co-leader' && (
                                <Crown className="w-4 h-4 text-[#F5C451]" />
                              )}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                member.status === 'active' ? 'bg-green-500/20 text-green-300' :
                                member.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-gray-500/20 text-gray-300'
                              }`}>
                                {member.status}
                              </span>
                            </div>
                            <div className="text-sm text-white/80">{member.email}</div>
                            <div className="text-xs text-white/60">
                              Joined {new Date(member.joinDate).toLocaleDateString()} • 
                              {member.attendance}% attendance
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-white/60 hover:text-white transition-colors">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-white/60 hover:text-white transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pending Invites */}
            {fellowshipData.pendingInvites.length > 0 && (
              <div className="bg-white/5 border border-[#D4AF37] rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-white mb-4">Pending Invites ({fellowshipData.pendingInvites.length})</h3>
                  <div className="space-y-3">
                    {fellowshipData.pendingInvites.map(invite => (
                      <div key={invite.id} className="bg-white/5 rounded-xl p-4 border border-[#D4AF37]/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-white">{invite.email}</div>
                            <div className="text-sm text-white/80">
                              Invited by {invite.invitedBy} • {new Date(invite.invitedDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors">
                              Resend
                            </button>
                            <button className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-[#D4AF37] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Events ({fellowshipData.recentEvents.length})</h3>
                  <button className="bg-[#F5C451] text-[#0F1433] px-4 py-2 rounded-lg font-semibold hover:bg-[#D4AF37] transition-colors flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Create Event</span>
                  </button>
                </div>
                
                <div className="space-y-3">
                  {fellowshipData.recentEvents.map(event => (
                    <div key={event.id} className="bg-white/5 rounded-xl p-4 border border-[#D4AF37]/30 hover:bg-white/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-semibold text-white">{event.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              event.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                              event.status === 'upcoming' ? 'bg-blue-500/20 text-blue-300' :
                              'bg-gray-500/20 text-gray-300'
                            }`}>
                              {event.status}
                            </span>
                          </div>
                          <div className="text-sm text-white/80 mb-2">
                            {new Date(event.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-white/70">
                            <div className="flex items-center space-x-1">
                              <Users className="w-4 h-4 text-[#F5C451]" />
                              <span>{event.attendees}/{event.maxAttendees} RSVPs</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="bg-white/10 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors border border-[#D4AF37]/50">
                            Manage
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-[#D4AF37] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Announcements ({fellowshipData.announcements.length})</h3>
                  <button className="bg-[#F5C451] text-[#0F1433] px-4 py-2 rounded-lg font-semibold hover:bg-[#D4AF37] transition-colors flex items-center space-x-2">
                    <Megaphone className="w-4 h-4" />
                    <span>New Announcement</span>
                  </button>
                </div>
                
                <div className="space-y-3">
                  {fellowshipData.announcements.map(announcement => (
                    <div key={announcement.id} className="bg-white/5 rounded-xl p-4 border border-[#D4AF37]/30 hover:bg-white/10 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-2">{announcement.title}</h4>
                          <p className="text-white/80 text-sm mb-2">{announcement.content}</p>
                          <div className="flex items-center space-x-4 text-xs text-white/60">
                            <span>By {announcement.author}</span>
                            <span>{new Date(announcement.date).toLocaleDateString()}</span>
                            <span>{announcement.readCount} reads</span>
                          </div>
                        </div>
                        <button className="p-2 text-white/60 hover:text-white transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-[#D4AF37] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5C451]/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-4">Fellowship Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">Privacy Level</div>
                      <div className="text-sm text-white/80">Currently: {fellowshipData.privacy}</div>
                    </div>
                    <button className="bg-white/10 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/20 transition-colors border border-[#D4AF37]/50">
                      Change
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">Joining Rules</div>
                      <div className="text-sm text-white/80">Currently: {fellowshipData.joiningRules.replace('_', ' ')}</div>
                    </div>
                    <button className="bg-white/10 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/20 transition-colors border border-[#D4AF37]/50">
                      Change
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">Maximum Members</div>
                      <div className="text-sm text-white/80">Currently: {fellowshipData.maxMembers}</div>
                    </div>
                    <button className="bg-white/10 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/20 transition-colors border border-[#D4AF37]/50">
                      Change
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
              <div className="space-y-3">
                <button className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center space-x-2">
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Fellowship</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Member Invite Modal */}
      <MemberInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        fellowshipName={fellowshipData.name}
        fellowshipId={params.id}
        inviteUrl={inviteUrl}
        onCreateInvite={handleCreateInvite}
        creatingInvite={creatingInvite}
      />
    </div>
  )
}
