import React from 'react';
import { User } from 'lucide-react';
import { resolveAssetUrl } from '../../utils/resolveAssetUrl';

interface Props {
  name: string;
  avatarUrl?: string;
}

function UserAvatar({ name, avatarUrl }: Props) {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2);

  if (avatarUrl) {
    return (
      <img
        src={resolveAssetUrl(avatarUrl)}
        alt={name}
        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
      {initials}
    </div>
  );
}

export default UserAvatar;