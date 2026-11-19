import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  FileUp,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  AdminNoticeRecord,
  ExtractableFieldKey,
  ExtractedNoticeResponse,
  FieldMeta,
} from '../types/notice';
import { DEFAULT_ADMIN_RECORDS } from '../data/defaultNotices';
import {
  copyText,
  formatDateRangeDisplay,
  formatTextField,
  splitTextToDetailBoxes,
  stripToUserNotice,
  validateAdminNotice,
} from '../utils/noticeHelpers';

interface AdminPageProps {
  records: AdminNoticeRecord[];
  onSaveRecord: (record: AdminNoticeRecord) => void;
  onDeleteRecord: (id: number) => void;
  onResetDefaults: () => void;
  onBackToUser: () => void;
}

function createEmptyRecord(nextId: number): AdminNoticeRecord {
  return {
    id: nextId,
    name: '',
    type: '행복주택',
    noticeDate: '',
    internetStart: '',
    internetEnd: '',
    visit: '',
    docResultDate: '',
    docSubmitStart: '',
    docSubmitEnd: '',
    winnerDate: '',
    supply: '',
    eligibility: '',
    points: '',
    documents: '',
    caution: '',
    houseNo: '',
    noticeUrl: 'https://www.i-sh.co.kr/app/index.do',
    applyUrl: 'https://www.i-sh.co.kr/app/index.do',
    reviewed: false,
    updatedAt: new Date().toISOString().slice(0, 10),
    meta: {},
  };
}

export default function AdminPage({
  records,
  onSaveRecord,
  onDeleteRecord,
  onResetDefaults,
  onBackToUser,
}: AdminPageProps) {
  const [adminView, setAdminView] = useState<'list' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<number>(() => records[0]?.id ?? 1);

  const activeSaved = useMemo(
    () => records.find((r) => r.id === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  const [draft, setDraft] = useState<AdminNoticeRecord>(() =>
    activeSaved
      ? { ...activeSaved, meta: { ...(activeSaved.meta ?? {}) } }
      : createEmptyRecord(1)
  );

  const [uploadTab, setUploadTab] = useState<'pdf' | 'text'>('pdf');
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [pendingExtracted, setPendingExtracted] =
    useState<ExtractedNoticeResponse | null>(null);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [jsonNote, setJsonNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectNoticeForEdit = (record: AdminNoticeRecord) => {
    setSelectedId(record.id);
    setDraft({ ...record, meta: { ...(record.meta ?? {}) } });
    setConfirmDelete(false);
    setStatusBanner(null);
    setExtractError(null);
    setPendingExtracted(null);
    setPdfFileName('');
    setPdfBase64('');
    setPastedText('');
    setUploadError(null);
    setAdminView('edit');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleAddNew = () => {
    const nextId =
      records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1;
    const fresh = createEmptyRecord(nextId);
    setSelectedId(nextId);
    setDraft(fresh);
    setConfirmDelete(false);
    setStatusBanner(null);
    setExtractError(null);
    setPendingExtracted(null);
    setPdfFileName('');
    setPdfBase64('');
    setPastedText('');
    setUploadError(null);
    setAdminView('edit');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleBackToAdminList = () => {
    setConfirmDelete(false);
    setPendingExtracted(null);
    setAdminView('list');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const updateField = <K extends keyof AdminNoticeRecord>(
    key: K,
    value: AdminNoticeRecord[K]
  ) => {
    setDraft((prev) => {
      const safeMeta = prev.meta ?? {};
      const next: AdminNoticeRecord = { ...prev, meta: safeMeta, [key]: value };
      if (key in safeMeta) {
        const metaKey = key as ExtractableFieldKey;
        const currentMeta = safeMeta[metaKey];
        if (currentMeta) {
          next.meta = {
            ...safeMeta,
            [metaKey]: { ...currentMeta, aiFilled: false },
          };
        }
      }
      // If summary text fields are edited in admin, clear static preset sub-items
      // so the updated text reflects cleanly on the user screen
      if (key === 'eligibility') delete next.eligibilityItems;
      if (key === 'points') delete next.pointsItems;
      if (key === 'documents') delete next.documentItems;
      if (key === 'caution') delete next.cautionItems;
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setUploadError('PDF로 변환하거나 본문을 붙여 넣어 주세요');
      setPdfFileName('');
      setPdfBase64('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setPdfFileName(file.name);
      setPdfBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const applyExtractedToDraft = (extracted: ExtractedNoticeResponse) => {
    setDraft((prev) => {
      const next: AdminNoticeRecord = {
        ...prev,
        meta: { ...(prev.meta ?? {}) },
      };

      const keys = Object.keys(extracted) as ExtractableFieldKey[];
      for (const k of keys) {
        const item = extracted[k];
        if (!item) continue;
        (next[k] as string) = item.value ?? '';
        next.meta[k] = {
          evidence: item.evidence ?? '',
          confidence: item.confidence ?? '못 찾음',
          aiFilled: Boolean(item.value),
        };
      }
      delete next.eligibilityItems;
      delete next.pointsItems;
      delete next.documentItems;
      delete next.cautionItems;
      return next;
    });
    setPendingExtracted(null);
    setStatusBanner('AI가 공고문 초안을 채웠습니다. 원문 근거를 확인한 뒤 저장해 주세요.');
  };

  const handleRunAiExtract = async () => {
    setExtractError(null);
    setStatusBanner(null);

    if (uploadTab === 'pdf' && !pdfBase64) {
      setExtractError('먼저 공고문 PDF 파일을 선택해 주세요.');
      return;
    }
    if (uploadTab === 'text' && !pastedText.trim()) {
      setExtractError('먼저 공고문 본문 텍스트를 붙여 넣어 주세요.');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await fetch('/api/extract-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          uploadTab === 'pdf' ? { pdfBase64 } : { textContent: pastedText }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.extracted) {
        setExtractError(
          data.error || '정리하지 못했어요. 직접 입력하거나 다시 시도해 주세요'
        );
        return;
      }

      const hasExistingContent = Boolean(
        draft.name.trim() ||
          draft.supply.trim() ||
          draft.eligibility.trim() ||
          draft.internetStart.trim()
      );

      if (hasExistingContent) {
        setPendingExtracted(data.extracted as ExtractedNoticeResponse);
      } else {
        applyExtractedToDraft(data.extracted as ExtractedNoticeResponse);
      }
    } catch {
      setExtractError('정리하지 못했어요. 직접 입력하거나 다시 시도해 주세요');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = () => {
    const updated: AdminNoticeRecord = {
      ...draft,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onSaveRecord(updated);
    setDraft(updated);
    setConfirmDelete(false);
    setStatusBanner(
      updated.reviewed
        ? `'${updated.name || '새 공고'}'이(가) 검수 완료 상태로 저장되어 사용자 화면에 반영되었습니다.`
        : `'${updated.name || '새 공고'}'이(가) 저장되어 사용자 화면에 반영되었습니다.`
    );
    setAdminView('list');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleDelete = () => {
    const isSavedRecord = records.some((r) => r.id === draft.id);
    if (!isSavedRecord) {
      setConfirmDelete(false);
      setAdminView('list');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    if (records.length <= 1) {
      setStatusBanner('최소 1건 이상의 공고는 유지되어야 합니다.');
      setConfirmDelete(false);
      return;
    }
    const remaining = records.filter((r) => r.id !== draft.id);
    onDeleteRecord(draft.id);
    setConfirmDelete(false);
    if (remaining[0]) {
      setSelectedId(remaining[0].id);
      setDraft({ ...remaining[0], meta: { ...(remaining[0].meta ?? {}) } });
    }
    setStatusBanner('공고를 삭제했습니다.');
    setAdminView('list');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleCopyJson = async () => {
    const reviewedRecords = records.filter((r) => r.reviewed);
    const unreviewedCount = records.length - reviewedRecords.length;
    const exportArray = reviewedRecords.map(stripToUserNotice);
    const ok = await copyText(JSON.stringify(exportArray, null, 2));
    if (ok) {
      setCopiedJson(true);
      setJsonNote(
        unreviewedCount > 0
          ? `검수 완료 ${reviewedRecords.length}건 복사됨 (검수 전 공고 ${unreviewedCount}건은 제외했어요)`
          : `검수 완료 ${reviewedRecords.length}건의 사용자 화면용 JSON을 복사했습니다.`
      );
      window.setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const warnings = useMemo(() => validateAdminNotice(draft), [draft]);

  const aiStats = useMemo(() => {
    const entries = Object.values(draft.meta ?? {}).filter(
      (m): m is FieldMeta => Boolean(m)
    );
    if (entries.length === 0) return null;
    const autoFilled = entries.filter((m) => m.aiFilled).length;
    const lowCount = entries.filter((m) => m.confidence === '낮음').length;
    const missingCount = entries.filter((m) => m.confidence === '못 찾음').length;
    return { autoFilled, lowCount, missingCount };
  }, [draft.meta]);

  const getInputClass = (key: ExtractableFieldKey, base = '') => {
    const meta = (draft.meta ?? {})[key];
    let borderBg = 'border-[#d5d9de] bg-white focus:border-[#029f48]';
    if (meta?.confidence === '못 찾음') {
      borderBg = 'border-amber-400 bg-amber-50 focus:border-amber-500';
    } else if (meta?.aiFilled) {
      borderBg = 'border-blue-400 bg-blue-50/40 focus:border-blue-500';
    }
    return `w-full px-3 py-2 text-[13.5px] text-[#191f28] rounded-[8px] border focus:outline-none transition-colors ${borderBg} ${base}`;
  };

  const renderFieldMeta = (key: ExtractableFieldKey) => {
    const meta = (draft.meta ?? {})[key];
    if (!meta) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
        {meta.confidence === '낮음' && (
          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">
            원문 확인
          </span>
        )}
        {meta.confidence === '못 찾음' && (
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
            못 찾음
          </span>
        )}
        {meta.evidence && (
          <span className="text-[#555d66] leading-snug">근거: {meta.evidence}</span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f6f9] text-[#1e1e23]">
      {/* 관리자 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-[#1e1e23] text-white border-b border-black/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-[8px] bg-white p-1 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/image_901df9d5.png"
                alt="SH 공식 로고"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] sm:text-base font-bold tracking-tight truncate">
                청약 비서 관리자
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToUser}
            className="min-h-[36px] px-3 py-1.5 bg-[#03c75a] hover:bg-[#029f48] text-white text-[13px] font-bold rounded-[8px] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>사용자 화면 보기</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {statusBanner && (
          <div className="bg-[#e8f9ef] border border-[#bde8cf] rounded-[10px] px-4 py-3 text-sm font-bold text-[#029f48] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              aria-label="알림 닫기"
              className="p-1 rounded hover:bg-[#d5f4e2] text-[#029f48] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {adminView === 'list' ? (
          /* ================= 관리자 공고 목록 페이지 ================= */
          <div className="space-y-4">
            <div className="bg-white border border-[#e5e8eb] rounded-[12px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] sm:text-[17px] font-extrabold text-[#1e1e23]">
                  등록된 공고 목록 ({records.length})
                </h2>
                <p className="text-[12.5px] text-[#555d66] mt-0.5">
                  공고를 선택해 내용을 수정하거나 새 공고를 등록하면 사용자 화면에 즉시 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddNew}
                className="min-h-[42px] px-4 py-2 bg-[#2f6bff] hover:bg-[#1e56e6] text-white text-[13.5px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>새 공고 추가</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {records.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-[#e5e8eb] hover:border-[#03c75a] rounded-[12px] p-4 flex flex-col justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-[4px] bg-[#f2f4f7] text-[#4e5968]">
                        {item.type || '유형 미입력'}
                      </span>
                      <span
                        className={`text-[11.5px] font-bold px-2 py-0.5 rounded-[4px] ${
                          item.reviewed
                            ? 'bg-[#e8f9ef] text-[#029f48]'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.reviewed ? '검수 완료' : '검수 전'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => selectNoticeForEdit(item)}
                      className="text-left w-full group cursor-pointer"
                    >
                      <h3 className="text-[15px] font-bold text-[#191f28] group-hover:text-[#029f48] leading-snug transition-colors">
                        {item.name || '(제목 없는 새 공고)'}
                      </h3>
                    </button>

                    <div className="space-y-1 text-[12.5px] text-[#4e5968]">
                      <p className="font-mono tabular-nums">
                        · 인터넷 접수:{' '}
                        <span className="font-semibold text-[#191f28]">
                          {formatDateRangeDisplay(item.internetStart, item.internetEnd)}
                        </span>
                      </p>
                      <p className="truncate">
                        · 공급 규모: {formatTextField(item.supply).text}
                      </p>
                      <p className="text-[11.5px] text-[#8b95a1] font-mono tabular-nums">
                        · 최근 수정: {item.updatedAt || '-'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => selectNoticeForEdit(item)}
                    className="w-full min-h-[38px] px-3 py-2 bg-[#f8fafc] hover:bg-[#e8f9ef] hover:text-[#029f48] hover:border-[#bde8cf] border border-[#d5d9de] text-[#191f28] text-[13px] font-bold rounded-[8px] transition-colors cursor-pointer"
                  >
                    수정 · 관리하기
                  </button>
                </article>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {/* JSON 복사 카드 */}
              <div className="bg-white border border-[#e5e8eb] rounded-[12px] p-4 space-y-2.5">
                <h3 className="text-sm font-extrabold text-[#1e1e23]">
                  사용자 화면용 JSON 내보내기
                </h3>
                <p className="text-xs text-[#555d66] leading-relaxed">
                  저장한 공고는 사용자 화면에 바로 반영되며, 필요 시 검수 완료 공고만 JSON으로도 복사할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="w-full min-h-[42px] px-3 py-2 bg-[#e8efff] hover:bg-[#dce6ff] text-[#2f6bff] border border-[#c7d6ff] text-[13px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>복사됐어요</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>사용자 화면용 JSON 복사</span>
                    </>
                  )}
                </button>
                {jsonNote && (
                  <p className="text-xs font-medium text-[#2f6bff] leading-snug">
                    {jsonNote}
                  </p>
                )}
              </div>

              {/* 기본 공고 초기화 카드 */}
              <div className="bg-white border border-[#e5e8eb] rounded-[12px] p-4 space-y-2.5 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-[#1e1e23]">
                    기본 공고 데이터 초기화
                  </h3>
                  <p className="text-xs text-[#555d66] leading-relaxed">
                    수정하거나 추가한 공고를 지우고 서울주택도시개발공사 공식 기본 공고 3건으로 되돌립니다.
                  </p>
                </div>

                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="w-full min-h-[42px] px-3 py-2 bg-[#f8fafc] hover:bg-[#f2f4f7] border border-[#d5d9de] text-xs font-bold text-[#4e5968] hover:text-[#1e1e23] rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>공식 SH 기본 공고 3건으로 초기화</span>
                  </button>
                ) : (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-[8px] space-y-2">
                    <p className="text-xs font-semibold text-amber-900">
                      수정한 내용을 지우고 기본 공고 3건으로 되돌릴까요?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onResetDefaults();
                          const firstDefault = DEFAULT_ADMIN_RECORDS[0];
                          if (firstDefault) {
                            setSelectedId(firstDefault.id);
                            setDraft({ ...firstDefault, meta: { ...firstDefault.meta } });
                          }
                          setConfirmReset(false);
                          setStatusBanner('공식 SH 기본 공고 3건으로 초기화했습니다.');
                        }}
                        className="flex-1 min-h-[36px] bg-amber-600 text-white text-xs font-bold rounded-[6px] cursor-pointer"
                      >
                        초기화
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="flex-1 min-h-[36px] bg-white border border-[#d5d9de] text-[#1e1e23] text-xs font-bold rounded-[6px] cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ================= 관리자 공고 등록 · 수정 페이지 ================= */
          <section className="max-w-4xl mx-auto space-y-4">
            <div className="bg-white border border-[#e5e8eb] rounded-[12px] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleBackToAdminList}
                className="min-h-[36px] px-3 py-1.5 bg-[#f2f4f7] hover:bg-[#e5e8eb] text-[#1e1e23] text-[13px] font-bold rounded-[8px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>관리자 목록으로</span>
              </button>

              <span className="text-[12.5px] font-semibold text-[#555d66]">
                {records.some((r) => r.id === draft.id)
                  ? `공고 수정 · ${draft.name || '(제목 미입력)'}`
                  : '새 공고 등록'}
              </span>
            </div>

            {/* 1. 공고문 업로드 + AI 초안 추출 */}
            <div className="bg-white border border-[#e5e8eb] rounded-[12px] p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#1e1e23] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#2f6bff]" />
                  <span>공고문 업로드 · AI 초안 정리</span>
                </h2>

                <div className="inline-flex bg-[#f2f4f7] p-1 rounded-[8px]">
                  <button
                    type="button"
                    onClick={() => setUploadTab('pdf')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-[6px] cursor-pointer transition-colors ${
                      uploadTab === 'pdf'
                        ? 'bg-white text-[#1e1e23] shadow-2xs'
                        : 'text-[#555d66]'
                    }`}
                  >
                    PDF 파일 올리기
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTab('text')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-[6px] cursor-pointer transition-colors ${
                      uploadTab === 'text'
                        ? 'bg-white text-[#1e1e23] shadow-2xs'
                        : 'text-[#555d66]'
                    }`}
                  >
                    본문 텍스트 붙여넣기
                  </button>
                </div>
              </div>

              {uploadTab === 'pdf' ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 py-2.5 bg-[#f8fafc] hover:bg-[#f2f4f7] border border-dashed border-[#8b95a1] rounded-[8px] text-sm font-semibold text-[#1e1e23] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileUp className="w-4 h-4 text-[#2f6bff]" />
                    <span>{pdfFileName ? pdfFileName : '공고문 PDF 선택'}</span>
                  </button>
                  <span className="text-xs text-[#555d66]">
                    HWP 파일은 PDF로 변환하거나 본문을 복사해 붙여넣어 주세요.
                  </span>
                </div>
              ) : (
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="SH 입주자 모집공고문 본문 텍스트를 붙여 넣어 주세요."
                  className="w-full px-3 py-2.5 text-sm bg-[#f8fafc] border border-[#d5d9de] rounded-[8px] focus:outline-none focus:border-[#2f6bff]"
                />
              )}

              {uploadError && (
                <p className="text-sm font-semibold text-[#e5362b]">{uploadError}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={handleRunAiExtract}
                  className="min-h-[48px] px-5 py-2.5 bg-[#2f6bff] hover:bg-[#1e56e6] disabled:bg-[#9aa3ad] text-white text-sm sm:text-[15px] font-bold rounded-[8px] inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isExtracting ? '정리 중입니다...' : 'AI로 정리하기'}</span>
                </button>

                {aiStats && (
                  <p className="text-xs sm:text-sm font-semibold text-[#555d66]">
                    자동 입력 {aiStats.autoFilled}개 · 원문 확인 필요 {aiStats.lowCount}개 · 못 찾음 {aiStats.missingCount}개
                  </p>
                )}
              </div>

              {extractError && (
                <div className="p-3 bg-[#fdecea] border border-[#f8cbc7] rounded-[8px] text-sm text-[#e5362b] font-medium">
                  {extractError}
                </div>
              )}

              {pendingExtracted && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-sm font-bold text-blue-950">
                    기존 내용을 AI 결과로 바꿀까요?
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyExtractedToDraft(pendingExtracted)}
                      className="min-h-[38px] px-3.5 py-1.5 bg-[#2f6bff] text-white text-xs font-bold rounded-[6px] cursor-pointer"
                    >
                      바꾸기
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingExtracted(null)}
                      className="min-h-[38px] px-3.5 py-1.5 bg-white border border-[#d5d9de] text-[#1e1e23] text-xs font-bold rounded-[6px] cursor-pointer"
                    >
                      유지하기
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. 자동 입력값 점검 경고 배너 */}
            {warnings.length > 0 && (
              <div className="bg-[#fff7e6] border border-[#fbe3b0] border-l-[5px] border-l-[#ff7a1a] rounded-[10px] p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[#c2540a]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>입력값 확인 ({warnings.length}건)</span>
                </div>
                <ul className="space-y-1 text-xs sm:text-sm text-[#555d66]">
                  {warnings.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 3. 공고 정보 편집 양식 */}
            <div className="bg-white border border-[#e5e8eb] rounded-[12px] p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    공고명 *
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="예: 2026년 2차 행복주택 입주자모집"
                    className={getInputClass('name')}
                  />
                  {renderFieldMeta('name')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    주택 유형 *
                  </label>
                  <input
                    type="text"
                    value={draft.type}
                    onChange={(e) => updateField('type', e.target.value)}
                    placeholder="국민임대 / 장기전세 / 행복주택"
                    className={getInputClass('type')}
                  />
                  {renderFieldMeta('type')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    주택관리번호
                  </label>
                  <input
                    type="text"
                    value={draft.houseNo}
                    onChange={(e) => updateField('houseNo', e.target.value)}
                    placeholder="예: 2026-000428"
                    className={getInputClass('houseNo', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('houseNo')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    공고일 (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(draft.noticeDate) ? draft.noticeDate : ''}
                    onChange={(e) => updateField('noticeDate', e.target.value)}
                    className={getInputClass('noticeDate', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('noticeDate')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    서류심사 대상자 발표일
                  </label>
                  <input
                    type="date"
                    value={
                      /^\d{4}-\d{2}-\d{2}$/.test(draft.docResultDate)
                        ? draft.docResultDate
                        : ''
                    }
                    onChange={(e) => updateField('docResultDate', e.target.value)}
                    className={getInputClass('docResultDate', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('docResultDate')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    인터넷 접수 시작일 *
                  </label>
                  <input
                    type="date"
                    value={
                      /^\d{4}-\d{2}-\d{2}$/.test(draft.internetStart)
                        ? draft.internetStart
                        : ''
                    }
                    onChange={(e) => updateField('internetStart', e.target.value)}
                    className={getInputClass('internetStart', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('internetStart')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    인터넷 접수 종료일 *
                  </label>
                  <input
                    type="date"
                    value={
                      /^\d{4}-\d{2}-\d{2}$/.test(draft.internetEnd)
                        ? draft.internetEnd
                        : ''
                    }
                    onChange={(e) => updateField('internetEnd', e.target.value)}
                    className={getInputClass('internetEnd', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('internetEnd')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    서류 제출 시작일
                  </label>
                  <input
                    type="date"
                    value={
                      /^\d{4}-\d{2}-\d{2}$/.test(draft.docSubmitStart)
                        ? draft.docSubmitStart
                        : ''
                    }
                    onChange={(e) => updateField('docSubmitStart', e.target.value)}
                    className={getInputClass('docSubmitStart', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('docSubmitStart')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    서류 제출 종료일
                  </label>
                  <input
                    type="date"
                    value={
                      /^\d{4}-\d{2}-\d{2}$/.test(draft.docSubmitEnd)
                        ? draft.docSubmitEnd
                        : ''
                    }
                    onChange={(e) => updateField('docSubmitEnd', e.target.value)}
                    className={getInputClass('docSubmitEnd', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('docSubmitEnd')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    당첨자 발표일 (YYYY-MM-DD 또는 추후 공지)
                  </label>
                  <input
                    type="text"
                    value={draft.winnerDate}
                    onChange={(e) => updateField('winnerDate', e.target.value)}
                    placeholder="2027-01-29 또는 추후 공지"
                    className={getInputClass('winnerDate', 'font-mono tabular-nums')}
                  />
                  {renderFieldMeta('winnerDate')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    공급 규모 *
                  </label>
                  <input
                    type="text"
                    value={draft.supply}
                    onChange={(e) => updateField('supply', e.target.value)}
                    placeholder="예: 총 1,484호 (신규 154호 · 재공급 1,330호)"
                    className={getInputClass('supply')}
                  />
                  {renderFieldMeta('supply')}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    방문 접수 일정
                  </label>
                  <input
                    type="text"
                    value={draft.visit}
                    onChange={(e) => updateField('visit', e.target.value)}
                    placeholder="예: 2026.09.10~09.11 10:00~17:00 (정보취약계층 한함)"
                    className={getInputClass('visit')}
                  />
                  {renderFieldMeta('visit')}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    신청자격 요약 (사용자 화면에서 문장별 박스로 표시)
                  </label>
                  <textarea
                    rows={3}
                    value={draft.eligibility}
                    onChange={(e) => updateField('eligibility', e.target.value)}
                    className={getInputClass('eligibility')}
                  />
                  {renderFieldMeta('eligibility')}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    가점 · 선정기준 요약
                  </label>
                  <textarea
                    rows={3}
                    value={draft.points}
                    onChange={(e) => updateField('points', e.target.value)}
                    className={getInputClass('points')}
                  />
                  {renderFieldMeta('points')}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    제출서류
                  </label>
                  <textarea
                    rows={2}
                    value={draft.documents}
                    onChange={(e) => updateField('documents', e.target.value)}
                    className={getInputClass('documents')}
                  />
                  {renderFieldMeta('documents')}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    놓치기 쉬운 사항
                  </label>
                  <textarea
                    rows={2}
                    value={draft.caution}
                    onChange={(e) => updateField('caution', e.target.value)}
                    className={getInputClass('caution')}
                  />
                  {renderFieldMeta('caution')}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    공고 게시글 링크
                  </label>
                  <input
                    type="url"
                    value={draft.noticeUrl}
                    onChange={(e) => updateField('noticeUrl', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-[#1e1e23] bg-white border border-[#d5d9de] rounded-[8px] focus:outline-none focus:border-[#029f48]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1e1e23] mb-1.5">
                    청약 신청 링크
                  </label>
                  <input
                    type="url"
                    value={draft.applyUrl}
                    onChange={(e) => updateField('applyUrl', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-[#1e1e23] bg-white border border-[#d5d9de] rounded-[8px] focus:outline-none focus:border-[#029f48]"
                  />
                </div>
              </div>

              {/* 원문 대조 검수 체크박스 + 저장/삭제/미리보기 버튼 */}
              <div className="pt-4 border-t border-[#e5e8eb] space-y-4">
                <label className="flex items-center gap-2.5 p-3 bg-[#f1faf5] border border-[#d3f0df] rounded-[8px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.reviewed}
                    onChange={(e) => updateField('reviewed', e.target.checked)}
                    className="w-4 h-4 accent-[#03c75a] cursor-pointer"
                  />
                  <span className="text-[13px] font-bold text-[#191f28]">
                    공고문 원문과 대조했습니다 (체크 시 검수 완료 상태로 저장)
                  </span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPreview(true)}
                      className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-[#f8fafc] border border-[#d5d9de] text-[#191f28] text-[13px] font-bold rounded-[8px] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>사용자 화면 미리보기</span>
                    </button>

                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="min-h-[40px] px-3.5 py-2 bg-[#fdecea] hover:bg-[#fbd7d3] text-[#e5362b] text-[13px] font-bold rounded-[8px] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>삭제</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDelete}
                          className="min-h-[40px] px-3 py-2 bg-[#e5362b] text-white text-[13px] font-bold rounded-[8px] cursor-pointer"
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="min-h-[40px] px-3 py-2 bg-[#f2f4f7] text-[#191f28] text-[13px] font-bold rounded-[8px] cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="min-h-[40px] px-5 py-2 bg-[#03c75a] hover:bg-[#029f48] text-white text-[13.5px] font-bold rounded-[8px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>저장 및 사용자 화면 반영</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="pt-4 pb-6 text-center text-sm text-[#8b95a1]">
          이 페이지는 생성형 AI(Google AI Studio)를 활용해 제작했습니다.
        </footer>
      </main>

      {/* 사용자 화면 미리보기 모달 */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="사용자 화면 미리보기"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-[#f3f6f9] w-full max-w-[420px] max-h-[90vh] rounded-[16px] overflow-hidden flex flex-col shadow-2xl border border-[#e5e8eb]">
            <div className="bg-white px-4 py-3 border-b border-[#e5e8eb] flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#1e1e23]">
                모바일 사용자 화면 미리보기
              </span>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                aria-label="미리보기 닫기"
                className="w-9 h-9 rounded-[8px] hover:bg-[#f2f4f7] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 text-[#555d66]" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <div className="bg-[#fff7e6] border border-[#fbe3b0] border-l-[4px] border-l-[#ff7a1a] rounded-[8px] px-3 py-2.5 text-xs text-[#555d66]">
                요약은 참고용이며, 정확한 내용은 공고문을 확인하세요.
              </div>

              <div className="bg-white border border-[#e5e8eb] border-l-[5px] border-l-[#03c75a] rounded-[12px] p-4 space-y-2">
                <span className="inline-block px-2 py-0.5 rounded-[4px] bg-[#e8f9ef] text-[#029f48] text-xs font-bold">
                  {draft.type || '유형'}
                </span>
                <h4 className="text-base font-bold text-[#1e1e23]">
                  {draft.name || '(공고명 미입력)'}
                </h4>
                <ul className="text-xs text-[#555d66] space-y-1">
                  <li>
                    · 인터넷 접수:{' '}
                    {formatDateRangeDisplay(draft.internetStart, draft.internetEnd)}
                  </li>
                  <li>· 공급 규모: {formatTextField(draft.supply).text}</li>
                </ul>
              </div>

              <div className="bg-white border border-[#e5e8eb] rounded-[12px] p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#1e1e23]">
                  <FileText className="w-4 h-4 text-[#03c75a]" />
                  <span>신청자격 · 가점 · 제출서류</span>
                </div>
                {splitTextToDetailBoxes(
                  draft.eligibility,
                  '신청자격',
                  draft.eligibilityItems
                ).map((b) => (
                  <div
                    key={b.label}
                    className="p-2.5 bg-[#f1faf5] border border-[#d3f0df] rounded-[8px]"
                  >
                    <span className="block text-[11px] font-bold text-[#029f48]">
                      {b.label}
                    </span>
                    <p className="text-xs text-[#1e1e23]">{b.value}</p>
                  </div>
                ))}
                {splitTextToDetailBoxes(draft.points, '가점', draft.pointsItems).map(
                  (b) => (
                    <div
                      key={b.label}
                      className="p-2.5 bg-[#f7f5ff] border border-[#e2dcff] rounded-[8px]"
                    >
                      <span className="block text-[11px] font-bold text-[#7b5cff]">
                        {b.label}
                      </span>
                      <p className="text-xs text-[#1e1e23]">{b.value}</p>
                    </div>
                  )
                )}
                {splitTextToDetailBoxes(
                  draft.documents,
                  '제출서류',
                  draft.documentItems
                ).map((b) => (
                  <div
                    key={b.label}
                    className="p-2.5 bg-[#effaf9] border border-[#c8efeb] rounded-[8px]"
                  >
                    <span className="block text-[11px] font-bold text-[#008f85]">
                      {b.label}
                    </span>
                    <p className="text-xs text-[#1e1e23]">{b.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
