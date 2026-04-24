/**
 * Список участников комнаты со статистикой, управлением ролями и быстрым добавлением друзей
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Crown, Shield, Eye, User, ChevronDown, Check, UserPlus, Link2, Copy, UserMinus, ArrowRightLeft } from 'lucide-react';
import { updateParticipantRole, addFriendsToRoom, generateInviteLink, kickParticipant, transferOwnership } from '../services/roomsAPI';
import { useTelegram } from '../contexts/TelegramContext';
import SelectFriendsModal from './SelectFriendsModal';
import { isSameUser } from '../utils/userIdentity';

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
  onRoleChanged,
  onParticipantsUpdated
}) => {
  const [changingRoleFor, setChangingRoleFor] = useState(null);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [showAddFriendsModal, setShowAddFriendsModal] = useState(false);
  const [isAddingFriends, setIsAddingFriends] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { webApp } = useTelegram();

  const currentUser = participants.find(p => isSameUser(p, { telegram_id: currentUserId }));
  const canChangeRoles = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');
  const canAddMembers = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin' || currentUser.role === 'moderator');

  const getRoleConfig = (roleId) => {
    return ROLES.find(r => r.id === roleId) || ROLES[3]; // default: member
  };

  // Генерация и копирование ссылки-приглашения
  const handleCopyInviteLink = async () => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('light');
    }

    try {
      setIsGeneratingLink(true);
      
      // Если ссылка еще не сгенерирована, генерируем
      let link = inviteLink;
      if (!link) {
        const linkData = await generateInviteLink(roomId, currentUserId);
        link = linkData.invite_link;
        setInviteLink(link);
      }
      
      // Копируем в буфер обмена
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
      
      // Сброс состояния через 2 секунды
      setTimeout(() => setLinkCopied(false), 2000);
      
    } catch (error) {
      console.error('Error generating/copying invite link:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setIsGeneratingLink(false);
    }
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

  const handleAddFriends = async (selectedFriends) => {
    if (!selectedFriends.length) return;
    
    setIsAddingFriends(true);
    try {
      await addFriendsToRoom(roomId, currentUserId, selectedFriends);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
      
      if (onParticipantsUpdated) {
        await onParticipantsUpdated();
      }
      
      setShowAddFriendsModal(false);
    } catch (error) {
      console.error('Error adding friends:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
      
      // Show error message
      const errorMessage = error.response?.data?.detail || 'Ошибка при добавлении друзей';
      if (webApp?.showPopup && webApp?.isVersionAtLeast?.('6.2')) {
        try {
          webApp.showPopup({
            title: 'Ошибка',
            message: errorMessage,
            buttons: [{ type: 'ok' }]
          });
        } catch (e) { alert(errorMessage); }
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsAddingFriends(false);
    }
  };

  // Исключить участника
  const handleKickParticipant = async (participant) => {
    const confirmKick = window.confirm(`Исключить ${participant.first_name} из комнаты?`);
    if (!confirmKick) return;

    try {
      await kickParticipant(roomId, participant.telegram_id, currentUserId);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
      if (onParticipantsUpdated) await onParticipantsUpdated();
    } catch (error) {
      console.error('Error kicking participant:', error);
      const msg = error.response?.data?.detail || 'Ошибка при исключении';
      alert(msg);
    }
  };

  // Передать права владельца
  const handleTransferOwnership = async (participant) => {
    const confirmTransfer = window.confirm(
      `Передать права владельца ${participant.first_name}?\nВы станете администратором.`
    );
    if (!confirmTransfer) return;

    try {
      await transferOwnership(roomId, currentUserId, participant.telegram_id);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
      if (onParticipantsUpdated) await onParticipantsUpdated();
    } catch (error) {
      console.error('Error transferring ownership:', error);
      const msg = error.response?.data?.detail || 'Ошибка при передаче прав';
      alert(msg);
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

  // IDs участников для исключения из списка друзей
  const existingParticipantIds = participants.map(p => p.telegram_id);

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Участники ({participants.length})
        </h4>
      </div>

      {/* Кнопки действий: добавить друзей и скопировать ссылку */}
      <div className="flex gap-2">
        {canAddMembers && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowAddFriendsModal(true);
              if (webApp?.HapticFeedback) {
                webApp.HapticFeedback.impactOccurred('light');
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 
                     bg-gradient-to-r from-purple-500 to-pink-500 
                     text-white text-xs font-medium rounded-xl
                     hover:opacity-90 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Добавить друзей
          </motion.button>
        )}
        
        {/* Кнопка копирования ссылки-приглашения */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleCopyInviteLink}
          disabled={isGeneratingLink}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 
                   text-xs font-medium rounded-xl transition-all
                   ${linkCopied 
                     ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                     : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                   }`}
        >
          {isGeneratingLink ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Генерация...
            </>
          ) : linkCopied ? (
            <>
              <Check className="w-4 h-4" />
              Скопировано!
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              Скопировать ссылку
            </>
          )}
        </motion.button>
      </div>

      {/* Info banner */}
      {canAddMembers && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-xs text-purple-300">
            💡 Быстро добавьте друзей или скопируйте ссылку-приглашение для отправки другим.
          </p>
        </div>
      )}

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
                      {isSameUser(participant, { telegram_id: currentUserId }) && (
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

                      {/* Разделитель */}
                      <div className="border-t border-gray-700 my-1" />

                      {/* Передать права (только для owner) */}
                      {currentUser?.role === 'owner' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsRoleMenuOpen(false);
                            setChangingRoleFor(null);
                            handleTransferOwnership(participant);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                                   text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors text-left"
                        >
                          <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">Передать права</span>
                        </button>
                      )}

                      {/* Исключить */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsRoleMenuOpen(false);
                          setChangingRoleFor(null);
                          handleKickParticipant(participant);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                                 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                      >
                        <UserMinus className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">Исключить</span>
                      </button>
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

      {/* Modal выбора друзей */}
      <SelectFriendsModal
        isOpen={showAddFriendsModal}
        onClose={() => setShowAddFriendsModal(false)}
        telegramId={currentUserId}
        onSelectFriends={handleAddFriends}
        excludeIds={existingParticipantIds}
        title="Добавить друзей в комнату"
      />
    </div>
  );
};

export default RoomParticipantsList;
