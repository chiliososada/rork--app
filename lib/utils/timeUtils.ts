/**
 * 智能时间格式化工具
 * 为聊天应用提供用户友好的时间显示
 */

export interface TimeFormatOptions {
  showSeconds?: boolean;
  use24Hour?: boolean;
  locale?: string;
}

/**
 * 获取两个日期之间的日期差
 */
function getDaysDifference(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDate = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const secondDate = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.round((firstDate.getTime() - secondDate.getTime()) / oneDay);
}

/**
 * 检查两个日期是否在同一天
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return getDaysDifference(date1, date2) === 0;
}

/**
 * 检查日期是否是今天
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * 检查日期是否是昨天
 */
export function isYesterday(date: Date): boolean {
  return getDaysDifference(new Date(), date) === 1;
}

/**
 * 检查日期是否在本周内（过去7天）
 */
export function isThisWeek(date: Date): boolean {
  const daysDiff = getDaysDifference(new Date(), date);
  return daysDiff >= 0 && daysDiff <= 7;
}

/**
 * 获取日语星期几
 */
function getJapaneseWeekday(date: Date): string {
  const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return weekdays[date.getDay()];
}

/**
 * 格式化时间为 HH:MM 格式
 */
function formatTime(date: Date, options: TimeFormatOptions = {}): string {
  const { showSeconds = false, use24Hour = true } = options;
  
  if (use24Hour) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = showSeconds ? `:${date.getSeconds().toString().padStart(2, '0')}` : '';
    return `${hours}:${minutes}${seconds}`;
  } else {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: true
    });
  }
}

/**
 * 智能格式化消息时间
 * 根据消息发送时间与当前时间的关系，选择最合适的显示格式
 */
export function formatMessageTime(dateString: string | Date, options: TimeFormatOptions = {}): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  
  if (isToday(date)) {
    // 今天的消息：只显示时间
    return formatTime(date, options);
  } else if (isYesterday(date)) {
    // 昨天的消息：显示 "昨日 + 时间"
    return `昨日 ${formatTime(date, options)}`;
  } else if (isThisWeek(date)) {
    // 本周内的消息：显示 "星期几 + 时间"
    return `${getJapaneseWeekday(date)} ${formatTime(date, options)}`;
  } else {
    // 更久前的消息：显示日期 + 时间
    const currentYear = now.getFullYear();
    const messageYear = date.getFullYear();
    
    if (currentYear === messageYear) {
      // 同年：显示 MM/DD HH:MM
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}/${day} ${formatTime(date, options)}`;
    } else {
      // 不同年：显示 YYYY/MM/DD HH:MM
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}/${month}/${day} ${formatTime(date, options)}`;
    }
  }
}

/**
 * 格式化聊天列表中的最后消息时间
 * 用于聊天列表页面，显示相对时间
 */
export function formatChatListTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 1) {
    return "今";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}分前`;
  } else if (diffInHours < 24) {
    return `${diffInHours}時間前`;
  } else if (diffInDays < 7) {
    return `${diffInDays}日前`;
  } else {
    return date.toLocaleDateString('ja-JP', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

/**
 * 格式化日期分隔符显示文本
 */
export function formatDateSeparator(date: Date): string {
  const now = new Date();
  
  if (isToday(date)) {
    return "今日";
  } else if (isYesterday(date)) {
    return "昨日";
  } else {
    const currentYear = now.getFullYear();
    const dateYear = date.getFullYear();
    
    if (currentYear === dateYear) {
      // 同年：显示 MM月DD日
      return date.toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric'
      });
    } else {
      // 不同年：显示 YYYY年MM月DD日
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }
}

/**
 * 将消息按日期分组
 * 返回按日期分组的消息数组，每组包含日期和该日期的消息
 */
export interface MessageGroup {
  date: Date;
  dateString: string;
  messages: any[];
}

export function groupMessagesByDate<T extends { createdAt: string | Date }>(messages: T[]): MessageGroup[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const groups: { [key: string]: MessageGroup } = {};
  
  messages.forEach(message => {
    const messageDate = typeof message.createdAt === 'string' 
      ? new Date(message.createdAt) 
      : message.createdAt;
    
    // 使用日期字符串作为分组键（YYYY-MM-DD格式）
    const dateKey = messageDate.toISOString().split('T')[0];
    
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate()),
        dateString: formatDateSeparator(messageDate),
        messages: []
      };
    }
    
    groups[dateKey].messages.push(message);
  });
  
  // 按日期排序（最新的在最后，符合聊天应用习惯）
  return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
}