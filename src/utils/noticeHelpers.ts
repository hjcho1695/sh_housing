import {
  AdminNoticeRecord,
  DetailBoxItem,
  NoticeItem,
  NoticeStatus,
} from '../types/notice';

export const MS_PER_DAY = 86400000;

export function parseUtcDay(dateStr: string): number | null {
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function formatDotDate(dateStr: string): string {
  const day = parseUtcDay(dateStr);
  if (day === null) return '추후 공지';
  return dateStr.trim().replace(/-/g, '.');
}

export function formatShortDotDate(dateStr: string): string {
  const day = parseUtcDay(dateStr);
  if (day === null) return '추후 공지';
  const parts = dateStr.trim().split('-');
  return `${parts[1]}.${parts[2]}`;
}

export function formatDateRangeDisplay(startStr: string, endStr: string): string {
  const startDay = parseUtcDay(startStr);
  const endDay = parseUtcDay(endStr);
  if (startDay === null || endDay === null) return '추후 공지';
  return `${formatDotDate(startStr)} ~ ${formatShortDotDate(endStr)}`;
}

export function formatTextField(value: string): { text: string; needsCheck: boolean } {
  const trimmed = value.trim();
  if (!trimmed || (trimmed.includes('【') && trimmed.includes('】'))) {
    return { text: '공고문 확인 필요', needsCheck: true };
  }
  return { text: trimmed, needsCheck: false };
}

export function getNoticeStatus(
  notice: NoticeItem,
  baseDateStr: string
): { status: NoticeStatus; dDay: number | null } {
  const baseDay = parseUtcDay(baseDateStr);
  const startDay = parseUtcDay(notice.internetStart);
  const endDay = parseUtcDay(notice.internetEnd);

  if (baseDay === null || startDay === null || endDay === null) {
    return { status: 'upcoming', dDay: null };
  }
  if (baseDay < startDay) {
    return { status: 'upcoming', dDay: startDay - baseDay };
  }
  if (baseDay <= endDay) {
    return { status: 'open', dDay: 0 };
  }
  return { status: 'closed', dDay: null };
}

export interface TimelineStep {
  key: string;
  stepNo: number;
  label: string;
  dateText: string;
  isNow: boolean;
  isPassed: boolean;
}

export function buildTimeline(notice: NoticeItem, baseDateStr: string): TimelineStep[] {
  const baseDay = parseUtcDay(baseDateStr);

  const rawSteps = [
    {
      key: 'notice',
      stepNo: 1,
      label: '공고',
      startDay: parseUtcDay(notice.noticeDate),
      endDay: parseUtcDay(notice.noticeDate),
      dateText: formatDotDate(notice.noticeDate),
    },
    {
      key: 'internet',
      stepNo: 2,
      label: '청약 접수',
      startDay: parseUtcDay(notice.internetStart),
      endDay: parseUtcDay(notice.internetEnd),
      dateText: formatDateRangeDisplay(notice.internetStart, notice.internetEnd),
    },
    {
      key: 'docResult',
      stepNo: 3,
      label: '서류심사 대상자 발표',
      startDay: parseUtcDay(notice.docResultDate),
      endDay: parseUtcDay(notice.docResultDate),
      dateText: formatDotDate(notice.docResultDate),
    },
    {
      key: 'docSubmit',
      stepNo: 4,
      label: '서류 제출',
      startDay: parseUtcDay(notice.docSubmitStart),
      endDay: parseUtcDay(notice.docSubmitEnd),
      dateText: formatDateRangeDisplay(notice.docSubmitStart, notice.docSubmitEnd),
    },
    {
      key: 'winner',
      stepNo: 5,
      label: '당첨자 발표',
      startDay: parseUtcDay(notice.winnerDate),
      endDay: parseUtcDay(notice.winnerDate),
      dateText: formatDotDate(notice.winnerDate),
    },
  ];

  let nowKey: string | null = null;

  if (baseDay !== null) {
    const calculable = rawSteps.filter(
      (s): s is typeof s & { startDay: number; endDay: number } =>
        s.startDay !== null && s.endDay !== null
    );

    const activeStep = calculable.find(
      (s) => s.startDay <= baseDay && baseDay <= s.endDay
    );
    if (activeStep) {
      nowKey = activeStep.key;
    } else {
      const upcomingSteps = calculable
        .filter((s) => s.startDay > baseDay)
        .sort((a, b) => a.startDay - b.startDay);
      if (upcomingSteps.length > 0) {
        nowKey = upcomingSteps[0].key;
      }
    }
  }

  return rawSteps.map((s) => ({
    key: s.key,
    stepNo: s.stepNo,
    label: s.label,
    dateText: s.dateText,
    isNow: s.key === nowKey,
    isPassed:
      baseDay !== null &&
      s.endDay !== null &&
      s.endDay < baseDay &&
      s.key !== nowKey,
  }));
}

export function buildGoogleCalendarUrl(notice: NoticeItem): string | null {
  const startDay = parseUtcDay(notice.internetStart);
  if (startDay === null) return null;

  const startYmd = notice.internetStart.trim().replace(/-/g, '');
  const nextUtc = new Date((startDay + 1) * MS_PER_DAY);
  const nextY = nextUtc.getUTCFullYear();
  const nextM = String(nextUtc.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(nextUtc.getUTCDate()).padStart(2, '0');
  const endYmd = `${nextY}${nextM}${nextD}`;

  const text = `[SH 청약] ${notice.name} 접수 시작`;
  const details = `접수기간 ${notice.internetStart} ~ ${notice.internetEnd} / 신청: ${notice.applyUrl} / ※ 정확한 내용은 공고문을 확인하세요.`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    text
  )}&dates=${startYmd}/${endYmd}&details=${encodeURIComponent(details)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function splitTextToDetailBoxes(
  rawText: string,
  fallbackLabel: string,
  presetItems?: DetailBoxItem[]
): DetailBoxItem[] {
  if (presetItems && presetItems.length > 0) {
    return presetItems;
  }
  const cleaned = formatTextField(rawText).text;
  const segments = cleaned
    .split(/\n+|(?<=[.])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return [{ label: fallbackLabel, value: cleaned }];
  }

  return segments.map((seg, idx) => ({
    label: `${fallbackLabel} ${idx + 1}`,
    value: seg,
  }));
}

export function validateAdminNotice(record: AdminNoticeRecord): string[] {
  const warnings: string[] = [];

  if (!record.name.trim()) warnings.push('필수 항목 누락: 공고명을 입력해 주세요.');
  if (!record.type.trim()) warnings.push('필수 항목 누락: 주택 유형을 입력해 주세요.');
  if (!record.internetStart.trim() || !record.internetEnd.trim()) {
    warnings.push('필수 항목 누락: 인터넷 접수 시작일·종료일을 입력해 주세요.');
  }
  if (!record.supply.trim()) warnings.push('필수 항목 누락: 공급 규모를 입력해 주세요.');

  const dateFields: Array<{ key: keyof AdminNoticeRecord; label: string }> = [
    { key: 'noticeDate', label: '공고일' },
    { key: 'internetStart', label: '인터넷 접수 시작일' },
    { key: 'internetEnd', label: '인터넷 접수 종료일' },
    { key: 'docResultDate', label: '서류심사 대상자 발표일' },
    { key: 'docSubmitStart', label: '서류 제출 시작일' },
    { key: 'docSubmitEnd', label: '서류 제출 종료일' },
    { key: 'winnerDate', label: '당첨자 발표일' },
  ];

  const nonIsoDates = dateFields
    .filter((f) => {
      const val = String(record[f.key] ?? '').trim();
      return val !== '' && parseUtcDay(val) === null;
    })
    .map((f) => f.label);

  if (nonIsoDates.length > 0) {
    warnings.push(
      `날짜 형식 안내 (${nonIsoDates.join(', ')}): YYYY-MM-DD 형식이 아닌 값은 사용자 화면에 '추후 공지'로 표시됩니다.`
    );
  }

  const orderedPairs: Array<[string, string, string, string]> = [
    ['noticeDate', '공고일', 'internetStart', '인터넷 접수 시작일'],
    ['internetStart', '인터넷 접수 시작일', 'internetEnd', '인터넷 접수 종료일'],
    ['internetEnd', '인터넷 접수 종료일', 'docResultDate', '서류심사 대상자 발표일'],
    ['docResultDate', '서류심사 대상자 발표일', 'docSubmitStart', '서류 제출 시작일'],
    ['docSubmitStart', '서류 제출 시작일', 'docSubmitEnd', '서류 제출 종료일'],
    ['docSubmitEnd', '서류 제출 종료일', 'winnerDate', '당첨자 발표일'],
  ];

  for (const [kA, lA, kB, lB] of orderedPairs) {
    const dA = parseUtcDay(String(record[kA as keyof AdminNoticeRecord] ?? ''));
    const dB = parseUtcDay(String(record[kB as keyof AdminNoticeRecord] ?? ''));
    if (dA !== null && dB !== null && dA > dB) {
      warnings.push(`날짜 순서 오류: ${lA}이(가) ${lB}보다 늦습니다.`);
    }
  }

  const lengthFields: Array<{ key: keyof AdminNoticeRecord; label: string }> = [
    { key: 'eligibility', label: '신청자격' },
    { key: 'points', label: '가점' },
    { key: 'documents', label: '제출서류' },
    { key: 'caution', label: '놓치기 쉬운 사항' },
  ];

  for (const f of lengthFields) {
    const val = String(record[f.key] ?? '').trim();
    if (val.length > 120) {
      warnings.push(
        `요약 길이 주의 (${f.label} ${val.length}자): 120자를 넘어 모바일에서 길어 보일 수 있습니다.`
      );
    }
  }

  return warnings;
}

export function stripToUserNotice(record: AdminNoticeRecord): NoticeItem {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    noticeDate: record.noticeDate,
    internetStart: record.internetStart,
    internetEnd: record.internetEnd,
    visit: record.visit,
    docResultDate: record.docResultDate,
    docSubmitStart: record.docSubmitStart,
    docSubmitEnd: record.docSubmitEnd,
    winnerDate: record.winnerDate,
    supply: record.supply,
    eligibility: record.eligibility,
    eligibilityItems: record.eligibilityItems,
    points: record.points,
    pointsItems: record.pointsItems,
    documents: record.documents,
    documentItems: record.documentItems,
    caution: record.caution,
    cautionItems: record.cautionItems,
    houseNo: record.houseNo,
    noticeUrl: record.noticeUrl,
    applyUrl: record.applyUrl,
  };
}
