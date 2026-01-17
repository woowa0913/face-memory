import React, { useState, useEffect } from 'react';
import { Person } from '../types';
import { dbService } from '../services/db';
import { Icons } from './Icon';

interface ProfileModalProps {
  person: Person;
  onClose: () => void;
  onUpdate: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ person, onClose, onUpdate }) => {
  const [formData, setFormData] = useState<Person>({ ...person });
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'IDLE' | 'CONFIRM'>('IDLE');
  const [statusMsg, setStatusMsg] = useState('');

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

  const handleChange = (field: keyof Person, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMsg('');
    try {
      await dbService.updatePerson(formData);
      setStatusMsg('저장되었습니다.');
      setTimeout(() => {
        onUpdate();
        onClose();
      }, 500);
    } catch (e) {
      console.error(e);
      setStatusMsg('저장 실패!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteStep === 'IDLE') {
      setDeleteStep('CONFIRM');
      return;
    }

    setIsSaving(true);
    try {
      await dbService.deletePerson(person.id);
      onUpdate();
      onClose();
    } catch (e) {
      console.error(e);
      setStatusMsg('삭제 실패');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Image */}
        <div className="relative h-48 bg-gray-100 flex items-center justify-center">
          {imageUrl ? (
            <>
              <img src={imageUrl} className="w-full h-full object-contain bg-black/5" alt="Face" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </>
          ) : (
            <Icons.Users size={48} className="text-gray-300" />
          )}
          
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 bg-black/30 text-white p-2 rounded-full hover:bg-black/50 transition"
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">이름</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl font-bold text-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">직군</label>
                <input 
                  type="text" 
                  value={formData.jobGroup || ''} 
                  onChange={(e) => handleChange('jobGroup', e.target.value)}
                  placeholder="IT, Biz..."
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">부서</label>
                <input 
                  type="text" 
                  value={formData.department} 
                  onChange={(e) => handleChange('department', e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                />
             </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">경력 / 회사</label>
            <input 
              type="text" 
              value={formData.career || ''} 
              onChange={(e) => handleChange('career', e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">특이사항 (메모)</label>
            <textarea 
              value={formData.notes} 
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm min-h-[80px]"
            />
          </div>

          {statusMsg && <p className="text-center text-sm font-bold text-indigo-600">{statusMsg}</p>}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
           {deleteStep === 'CONFIRM' ? (
              <>
                 <button 
                  onClick={() => setDeleteStep('IDLE')}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-medium rounded-xl"
                 >
                   취소
                 </button>
                 <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700"
                 >
                   확인 (삭제)
                 </button>
              </>
           ) : (
              <>
                <button 
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-4 py-3 text-red-500 font-medium hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                >
                  삭제
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : '저장 완료'}
                </button>
              </>
           )}
        </div>
      </div>
    </div>
  );
};