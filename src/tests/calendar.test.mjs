import { upcomingEvents } from '../lib/calendar.mjs';
const now=Date.parse('2026-09-19T00:00:00Z');
const calendar=events=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`;
const event=lines=>`BEGIN:VEVENT\r\n${lines}\r\nEND:VEVENT`;
test('parses Singapore, UTC, floating times and escaped locations',()=>{
  const data=calendar(event('UID:one\r\nDTSTART;TZID=Asia/Singapore:20260919T093000\r\nSUMMARY:Standup\r\nLOCATION:One-North\\, Singapore'));
  const result=upcomingEvents(data,now);expect(result.events[0].start).toBe('2026-09-19T01:30:00.000Z');expect(result.events[0].location).toBe('One-North, Singapore');
  expect(upcomingEvents(calendar(event('UID:two\r\nDTSTART:20260919T093000')),now).events[0].start).toBe('2026-09-19T01:30:00.000Z');
});
test('recurrence, EXDATE, cancellation and UID-scoped overrides',()=>{
  const data=calendar([
    event('UID:a\r\nDTSTART:20260918T020000Z\r\nRRULE:FREQ=DAILY;COUNT=5\r\nEXDATE:20260919T020000Z\r\nLOCATION:Original'),
    event('UID:a\r\nRECURRENCE-ID:20260920T020000Z\r\nDTSTART:20260920T030000Z\r\nLOCATION:Moved'),
    event('UID:a\r\nRECURRENCE-ID:20260921T020000Z\r\nDTSTART:20260921T020000Z\r\nSTATUS:CANCELLED'),
    event('UID:b\r\nDTSTART:20260919T010000Z\r\nSTATUS:CANCELLED'),
  ].join('\r\n'));
  const result=upcomingEvents(data,now);expect(result.events[0].location).toBe('Moved');expect(result.events[0].start).toBe('2026-09-20T03:00:00.000Z');expect(result.events).toHaveLength(2);
});
test('reports unsupported zones and all-day events instead of inventing departure times',()=>{
  const result=upcomingEvents(calendar([event('UID:a\r\nDTSTART;VALUE=DATE:20260920'),event('UID:b\r\nDTSTART;TZID=Unknown/Zone:20260920T090000')].join('\r\n')),now);
  expect(result.events).toHaveLength(0);expect(result.warnings).toHaveLength(2);expect(()=>upcomingEvents('bad',now)).toThrow();
});
