import React, { useEffect, useState } from 'react';
import { Person } from '../types';
import { dbService } from '../services/db';
import { Icons } from './Icon';

interface PersonCardProps {
  person: Person;
  onClick?: () => void;
  minimal?: boolean;
}

export const PersonCard: React.FC<PersonCardProps> = ({ person, onClick, minimal }) => {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    dbService.getFaceCrop(person.faceCropId).then(crop => {
      if (active && crop) {
        setImageUrl(URL.createObjectURL(crop.blob));
      }
    });
    return () => {
      active = false;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [person.faceCropId]);

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-95 transition-transform cursor-pointer flex items-center p-3 relative"
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-indigo-50">
        {imageUrl ? (
          <img src={imageUrl} alt={person.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">?</div>
        )}
      </div>
      <div className="ml-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-gray-900 truncate">{person.name}</h3>
          {person.jobGroup && (
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium border border-indigo-100">
              {person.jobGroup}
            </span>
          )}
        </div>
        
        {person.career && (
             <p className="text-xs text-gray-500 font-medium truncate flex items-center gap-1 mb-0.5">
               <Icons.GraduationCap size={12} />
               {person.career}
             </p>
        )}
        
        {!minimal && (
          <p className="text-xs text-gray-400 truncate">{person.notes}</p>
        )}
      </div>
      {!minimal && (
         <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${person.repetition > 2 ? 'bg-green-500' : 'bg-orange-300'}`} />
      )}
    </div>
  );
};