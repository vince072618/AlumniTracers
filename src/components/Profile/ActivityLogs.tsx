import React, { useState, useEffect } from 'react';
import { Clock, User, Lock, LogIn, LogOut, Mail, GraduationCap, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ActivityLog, ActivityType } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const ActivityLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchActivityLogs();
    }
  }, [user]);

  const fetchActivityLogs = async () => {
    try {
      setIsLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        throw fetchError;
      }

      const formattedLogs: ActivityLog[] = (data || []).map(log => ({
        id: log.id,
        userId: log.user_id,
        activityType: log.activity_type as ActivityType,
        description: log.description,
        metadata: log.metadata || {},
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        createdAt: new Date(log.created_at),
      }));

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      setError('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (activityType: ActivityType) => {
    switch (activityType) {
      case 'login':
        return <LogIn className="text-green-600" size={16} />;
      case 'logout':
        return <LogOut className="text-gray-600" size={16} />;
      case 'profile_update':
        return <User className="text-blue-600" size={16} />;
      case 'password_change':
        return <Lock className="text-orange-600" size={16} />;
      case 'registration':
        return <GraduationCap className="text-purple-600" size={16} />;
      case 'email_verification':
        return <Mail className="text-green-600" size={16} />;
      default:
        return <Clock className="text-gray-600" size={16} />;
    }
  };

  const getActivityColor = (activityType: ActivityType) => {
    switch (activityType) {
      case 'login':
        return 'bg-green-50 border-green-200';
      case 'logout':
        return 'bg-gray-50 border-gray-200';
      case 'profile_update':
        return 'bg-blue-50 border-blue-200';
      case 'password_change':
        return 'bg-orange-50 border-orange-200';
      case 'registration':
        return 'bg-purple-50 border-purple-200';
      case 'email_verification':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const renderMetadata = (metadata: Record<string, any>) => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return null;
    }

    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <h5 className="text-xs font-medium text-gray-700 mb-2">Changes Made:</h5>
        <div className="space-y-2">
          {Object.entries(metadata).map(([key, value]) => {
            if (typeof value === 'object' && value.old !== undefined && value.new !== undefined) {
              return (
                <div key={key} className="text-xs">
                  <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                  <div className="ml-2">
                    <span className="text-red-600">- {value.old || '(empty)'}</span>
                    <br />
                    <span className="text-green-600">+ {value.new || '(empty)'}</span>
                  </div>
                </div>
              );
            }
            return (
              <div key={key} className="text-xs">
                <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                <span className="ml-2">{JSON.stringify(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin text-blue-600 mr-2" size={20} />
          <span className="text-gray-600">Loading activity logs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchActivityLogs}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} className="mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Activity Logs</h3>
          <button
            onClick={fetchActivityLogs}
            className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={14} className="mr-1" />
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Track your account activities and profile changes
        </p>
      </div>

      <div className="p-6">
        {logs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600">No activity logs found</p>
            <p className="text-sm text-gray-500 mt-1">
              Your account activities will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const isExpanded = expandedLogs.has(log.id);
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div
                  key={log.id}
                  className={`border rounded-lg p-4 transition-colors ${getActivityColor(log.activityType)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="mt-0.5">
                        {getActivityIcon(log.activityType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {log.description}
                        </p>
                        <div className="flex items-center mt-1 text-xs text-gray-500 space-x-4">
                          <span>{formatDate(log.createdAt)}</span>
                          {log.ipAddress && log.ipAddress !== 'client-side' && (
                            <span>IP: {log.ipAddress}</span>
                          )}
                        </div>
                        {isExpanded && log.userAgent && (
                          <p className="text-xs text-gray-500 mt-2">
                            <span className="font-medium">Device:</span> {log.userAgent}
                          </p>
                        )}
                        {isExpanded && renderMetadata(log.metadata)}
                      </div>
                    </div>
                    {(hasMetadata || log.userAgent) && (
                      <button
                        onClick={() => toggleLogExpansion(log.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;