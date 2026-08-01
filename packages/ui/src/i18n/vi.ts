import type { Messages } from "./messages";

/**
 * Vietnamese catalog. Typed as `Messages`, so it must define exactly the keys in
 * the English source — TypeScript flags any missing one.
 */
export const vi: Messages = {
  "lang.label": "Ngôn ngữ",
  "lang.en": "English",
  "lang.vi": "Tiếng Việt",

  "toolbar.new": "Mới",
  "toolbar.open": "Mở",
  "toolbar.undo": "Hoàn tác",
  "toolbar.redo": "Làm lại",
  "toolbar.validate": "Kiểm tra",
  "toolbar.analyze": "Phân tích",
  "toolbar.aiSuggest": "Gợi ý AI",
  "toolbar.aiAnalyzing": "Đang phân tích…",
  "toolbar.exportJson": "Xuất JSON",
  "toolbar.exportAscii": "Xuất ASCII",
  "toolbar.exportPng": "Xuất PNG",
  "toolbar.exportGltf": "Xuất glTF",
  "toolbar.help": "Trợ giúp",

  "view.2d": "2D",
  "view.3d": "3D",

  "tool.select": "Chọn",
  "tool.place": "Đặt",
  "tool.wall": "Tường",
  "tool.delete": "Xóa",
  "tool.hand": "Di chuyển",
  "tool.select.hint": "Chọn & xem công trình",
  "tool.place.hint": "Đặt công trình đã chọn",
  "tool.wall.hint": "Vẽ tường (kéo)",
  "tool.delete.hint": "Xóa công trình & tường",
  "tool.hand.hint": "Kéo để di chuyển khung nhìn",

  "panel.buildings": "Công trình",
  "panel.inspector": "Chi tiết",
  "panel.history": "Lịch sử",
  "panel.replay": "Xem lại trận đánh",
  "panel.stats": "Thống kê",
  "panel.validation": "Kiểm tra",
  "panel.analysis": "Điểm phòng thủ",
  "panel.ai": "Gợi ý từ AI",
  "panel.log": "Nhật ký sự kiện",
};
