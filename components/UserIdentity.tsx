import React from 'react';
import { VerifiedBadge } from './VerifiedBadge';

interface Props {
  name?: string;
  username?: string;
  avatar?: string;
  uid?: string;
  verified?: boolean;
  verificationColor?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const UserIdentity: React.FC<Props> = ({ name='User', username, avatar, uid, verified, verificationColor, size='md', onClick }) => {
  const avatarSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const Wrapper: any = onClick ? 'button' : 'div';
  return <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className={`inline-flex items-center gap-2 text-left ${onClick ? 'hover:opacity-80' : ''}`}>
    {avatar ? <img src={avatar} alt={name} className={`${avatarSize} object-cover border-2 border-black bg-white shrink-0`} /> : <div className={`${avatarSize} border-2 border-black bg-[var(--color-secondary)] grid place-items-center font-display font-black text-xs shrink-0`}>{String(name).slice(0,1).toUpperCase()}</div>}
    <div className="min-w-0">
      <div className="font-display font-black text-sm uppercase flex items-center gap-1 truncate"><span className="truncate">{name}</span><VerifiedBadge verified={verified} color={verificationColor} className="w-3.5 h-3.5 shrink-0" /></div>
      <div className="font-mono text-[10px] text-neutral-500 truncate">{username ? `@${username}` : uid ? `ID ${uid}` : 'ACCOUNT'}</div>
    </div>
  </Wrapper>;
};
