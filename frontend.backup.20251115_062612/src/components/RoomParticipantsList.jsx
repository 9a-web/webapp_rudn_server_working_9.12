/**
 * Список участников комнаты со статистикой и управлением ролями
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Crown, Shield, Eye, User, ChevronDown, Check } from 'lucide-react';
import { updateParticipantRole } from '../services/roomsAPI';
import { useTelegram } from '../contexts/TelegramContext';

const ROLES = [
  { id: 'owner', name: 'Владелец', icon: Crown, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  { id: 'admin', name: 'Администратор', icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/10' },
  { id: 'moderator', name: 'Модератор', icon: User, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { id: 'member', name: 'Участник', icon: User, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  { id: 'viewer', name: 'Наблюдатель', icon: Eye, color: 'text-gray-400', bgColor: 'bg-gray-500/10' }
];

const RoomParticipantsList = ({ 
  participants = [], 
  currentUserId, 
  roomId, 
  onRoleChanged 
}) => {
  const [changingRoleFor, setChangingRoleFor] = useState(null);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const { webApp } = useTelegram();

  const currentUser = participants.find(p => p.telegram_id === currentUserId);
  const canChangeRoles = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');

  const getRoleConfig = (roleId) => {
    return ROLES.find(r => r.id === roleId) || ROLES[3]; // default: member
  };

  const handleRoleChange = async (participant, newRole) => {
    if (!canChangeRoles) return;
    if (participant.role === 'owner') return; // Нельзя менять роль владельца
    if (newRole === participant.role) {
      setIsRoleMenuOpen(false);
      setChangingRoleFor(null);
      return;
    }

    try {
      await updateParticipantRole(
        roomId, 
        participant.telegram_id, 
        newRole, 
        currentUserId
      );
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
      
      if (onRoleChanged) {
        await onRoleChanged();
      }
      
      setIsRoleMenuOpen(false);
      setChangingRoleFor(null);
    } catch (error) {
      console.error('Error changing role:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleOpenRoleMenu = (participant) => {
    if (!canChangeRoles || participant.role === 'owner') return;
    
    setChangingRoleFor(participant.telegram_id);
    setIsRoleMenuOpen(true);
    
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('light');
    }
  };

  // Сортировка: владелец первый, затем по ролям, затем по алфавиту
  const sortedParticipants = [...participants].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3, viewer: 4 };
    if (roleOrder[a.role] !== roleOrder[b.role]) {
      return roleOrder[a.role] - roleOrder[b.role];
    }
    return a.first_name.localeCompare(b.first_name);
  });

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Участники ({participants.length})
        </h4>
      </div>

      {/* Список участников */}
      <div className="space-y-2">
        {sortedParticipants.map((participant) => {
          const roleConfig = getRoleConfig(participant.role);
          const RoleIcon = roleConfig.icon;
          const isChangingRole = changingRoleFor === participant.telegram_id;

          return (
            <motion.div
              key={participant.telegram_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className={`
                flex items-center justify-between p-3 
                bg-gray-800/50 border border-gray-700 rounded-xl
                hover:border-gray-600 transition-colors
                ${canChangeRoles && participant.role !== 'owner' ? 'cursor-pointer' : ''}
              `}
              onClick={() => handleOpenRoleMenu(participant)}
              >
                {/* Аватар и имя */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`
                    w-10 h-10 rounded-full ${roleConfig.bgColor} 
                    flex items-center justify-center flex-shrink-0
                  `}>
                    <span className="text-lg font-bold text-white">
                      {participant.first_name[0].toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {participant.first_name}
                      </span>
                      {participant.telegram_id === currentUserId && (
                        <span className="text-xs text-blue-400">(вы)</span>
                      )}
                    </div>
                    {participant.username && (
                      <span className="text-xs text-gray-500">
                        @{participant.username}
                      </span>
                    )}
                  </div>
                </div>

                {/* Роль */}
                <div className="flex items-center gap-2">
                  {/* Статистика (если есть) */}
                  {(participant.tasks_completed > 0 || participant.tasks_created > 0) && (
                    <div className="hidden sm:flex items-center gap-3 mr-3 text-xs text-gray-500">
                      {participant.tasks_created > 0 && (
                        <span>📝 {participant.tasks_created}</span>
                      )}
                      {participant.tasks_completed > 0 && (
                        <span>✅ {participant.tasks_completed}</span>
                      )}
                    </div>
                  )}

                  {/* Бейдж роли */}
                  <div className={`
                    flex items-center gap-1.5 px-2.5 py-1 
                    ${roleConfig.bgColor} ${roleConfig.color}
                    rounded-lg border border-current/20
                  `}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">
                      {roleConfig.name}
                    </span>
                    {canChangeRoles && participant.role !== 'owner' && (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </div>
              </div>

              {/* Dropdown меню изменения роли */}
              {isChangingRole && isRoleMenuOpen && (
                <>
                  {/* Backdrop для закрытия */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setIsRoleMenuOpen(false);
                      setChangingRoleFor(null);
                    }}
                  />
                  
                  {/* Меню */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 z-50
                             w-56 bg-gray-800 border border-gray-700 rounded-xl
                             shadow-xl overflow-hidden"
                  >
                    <div className="p-2 space-y-1">
                      <div className="px-3 py-2 text-xs font-medium text-gray-400">
                        Изменить роль
                      </div>
                      {ROLES.filter(r => r.id !== 'owner').map((role) => {
                        const RIcon = role.icon;
                        const isCurrent = participant.role === role.id;
                        
                        return (
                          <button
                            key={role.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRoleChange(participant, role.id);
                            }}
                            className={`
                              w-full flex items-center gap-2 px-3 py-2 rounded-lg
                              text-sm transition-colors text-left
                              ${isCurrent 
                                ? `${role.bgColor} ${role.color}` 
                                : 'text-gray-300 hover:bg-gray-700'
                              }
                            `}
                          >
                            <RIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{role.name}</span>
                            {isCurrent && (
                              <Check className="w-4 h-4 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Подсказка для администраторов */}
      {canChangeRoles && (
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-xs text-blue-200">
            💡 Нажмите на участника, чтобы изменить его роль
          </p>
        </div>
      )}
    </div>
  );
};

export default RoomParticipantsList;
