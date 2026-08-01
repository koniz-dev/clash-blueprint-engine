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

  "app.loading3d": "Đang tải chế độ 3D…",

  "action.copy": "Sao chép",
  "action.delete": "Xóa",
  "action.deleteAll": "Xóa tất cả",
  "action.rotate": "Xoay",

  "inspector.multiSelected": "Đã chọn {count} công trình.",
  "inspector.empty":
    "Chọn một công trình để xem chi tiết. Shift-click để chọn nhiều; ⌘/Ctrl+C / V để sao chép & dán.",
  "inspector.name": "Tên",
  "inspector.position": "Vị trí",
  "inspector.rotation": "Góc xoay",

  "stats.buildings": "Công trình",
  "stats.walls": "Tường",

  "validation.empty": "Bấm “Kiểm tra” để rà soát bố cục.",
  "validation.ok": "Không có vấn đề — bố cục hợp lệ.",

  "analysis.empty": "Bấm “Phân tích” để xem đánh giá phòng thủ.",

  "ai.loading": "Đang phân tích (mô phỏng tấn công)…",
  "ai.empty": "Bấm “Gợi ý AI” để nhận đề xuất cải thiện.",
  "ai.none": "Không tìm thấy cải thiện — bố cục đã tốt!",
  "ai.applyMove": "Áp dụng di chuyển",

  "history.empty": "Chưa có thao tác — đặt một công trình để bắt đầu.",

  "replay.intro": "Thả quân rồi chạy mô phỏng tấn công tất định.",
  "replay.deploy": "Thả quân",
  "replay.deploying": "Đang thả…",
  "replay.placed": "Đã thả {count}",
  "replay.clear": "Xóa",
  "replay.play": "▶ Bắt đầu tấn công",
  "replay.result": "Kết quả",
  "replay.pause": "⏸ Tạm dừng",
  "replay.resume": "▶ Chạy",
  "replay.time": "Thời gian phát lại",
  "replay.exit": "Thoát",

  "open.button": "Mở",
  "open.templates": "Mẫu có sẵn",
  "open.file": "Tệp",
  "open.import": "Nhập JSON…",

  "confirm.discard": "Bỏ & tiếp tục",
  "confirm.cancel": "Hủy",
  "discard.new": "Tạo bố cục mới? Bố cục hiện tại sẽ bị thay thế.",
  "discard.open": "Mở “{name}”? Bố cục hiện tại sẽ bị thay thế.",

  "library.search": "Tìm công trình…",
  "library.noMatch": "Không có công trình khớp “{query}”.",

  "help.title": "Phím tắt",
  "help.close": "Đóng",
  "help.closeAria": "Đóng bảng phím tắt",
  "help.mouse": "Chuột",
  "group.Edit": "Chỉnh sửa",
  "group.Selection": "Lựa chọn",
  "group.Tools": "Công cụ",
  "group.View": "Xem",

  "shortcut.undo": "Hoàn tác",
  "shortcut.redo": "Làm lại",
  "shortcut.copy": "Sao chép lựa chọn",
  "shortcut.paste": "Dán",
  "shortcut.delete-selection": "Xóa lựa chọn",
  "shortcut.nudge": "Dịch lựa chọn",
  "shortcut.rotate": "Xoay lựa chọn",
  "shortcut.tool-select": "Công cụ Chọn",
  "shortcut.tool-place": "Công cụ Đặt",
  "shortcut.tool-wall": "Công cụ Tường",
  "shortcut.tool-delete": "Công cụ Xóa",
  "shortcut.tool-hand": "Công cụ Di chuyển (pan)",
  "shortcut.help": "Hiện phím tắt",

  "gesture.marquee.label": "Kéo (vùng trống)",
  "gesture.marquee.hint": "Chọn theo khung",
  "gesture.move.label": "Kéo một công trình",
  "gesture.move.hint": "Di chuyển (một bước hoàn tác)",
  "gesture.shift.label": "Shift + click",
  "gesture.shift.hint": "Thêm / bỏ khỏi lựa chọn",
  "gesture.pan.label": "Space + kéo",
  "gesture.pan.hint": "Di chuyển khung nhìn",
  "gesture.wheel.label": "Lăn chuột",
  "gesture.wheel.hint": "Phóng to quanh con trỏ",

  "category.defense": "Phòng thủ",
  "category.resource": "Tài nguyên",
  "category.storage": "Kho chứa",
  "category.army": "Quân đội",
  "category.trap": "Bẫy",
  "category.wall": "Tường",
  "category.townhall": "Đại sảnh",
};
