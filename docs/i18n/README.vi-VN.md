# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Property Order cho phép bạn kéo các giá trị danh sách trong phần Thuộc tính của Obsidian, đồng thời chọn những tên và giá trị thuộc tính được gợi ý khi nhập.

## Minh họa

Trên máy tính, bạn có thể kéo một giá trị từ thuộc tính danh sách này sang thuộc tính danh sách khác trong cùng ghi chú:

![Di chuyển giá trị giữa các thuộc tính](../assets/property-order-cross-property-drag.gif)

Kéo giữa các thuộc tính được bật mặc định. Bạn có thể tắt tính năng này trong cài đặt Thứ tự giá trị.

## Tính năng

- Kéo các giá trị trong danh sách YAML cấp cao nhất được hỗ trợ để thay đổi thứ tự.
- Di chuyển giá trị giữa các thuộc tính danh sách được hỗ trợ trong cùng ghi chú. Di chuyển giữa các thuộc tính được bật mặc định và có thể tắt.
- Khi Obsidian coi một giá trị trống hoặc giá trị đơn là thuộc tính danh sách, Property Order vẫn có thể đưa giá trị vào hoặc ra một cách an toàn. Các mục không phải văn bản được chuyển thành văn bản theo đúng cách viết YAML ban đầu.
- Giữ định dạng danh sách hiện tại của từng thuộc tính, hoặc chọn danh sách trong ngoặc vuông hay mỗi mục một dòng. Mỗi lần kéo thành công tạo một thay đổi có thể hoàn tác bằng một thao tác.
- Hỗ trợ bố cục xuống dòng và bố cục từ phải sang trái. Có thể cuộn các vùng Thuộc tính được hỗ trợ khi kéo gần mép và thông báo thay đổi trạng thái kéo cho trình đọc màn hình.
- Tùy chỉnh gợi ý tên thuộc tính của Obsidian: ghim ở đầu, đặt ở cuối, ẩn, sắp xếp theo tên, dùng gần đây hoặc số ghi chú. Có thể nhóm theo kiểu thuộc tính.
- Có thể cấu hình gợi ý giá trị riêng cho từng thuộc tính: thứ tự Obsidian, theo tên, số lần chọn đã xác nhận, số ghi chú, không hiển thị gợi ý hoặc gợi ý tùy chỉnh.
- Gợi ý tùy chỉnh có thể được ghim ở đầu, nằm trong phần thông thường hoặc đặt ở cuối. Giá trị định sẵn vẫn có thể được chọn ngay cả khi chưa có ghi chú nào sử dụng.
- Lịch sử tên dùng gần đây và số lần chọn giá trị chỉ thay đổi sau khi Obsidian xác nhận nội dung chỉnh sửa. Di chuột lên, duyệt các gợi ý, hủy hoặc chưa xác nhận chỉnh sửa đều không được tính.
- Nếu không thể hiểu YAML hoặc giao diện gợi ý của Obsidian một cách an toàn, Property Order giữ nguyên ghi chú hoặc giao diện gốc.

## Yêu cầu và khả năng tương thích

- Obsidian 1.12.7 trở lên.
- Trên máy tính có thể kéo trực tiếp. Trên thiết bị di động, cần chọn thao tác trong menu nhấn giữ của Obsidian trước khi kéo.
- Kéo giá trị chỉ áp dụng cho thuộc tính YAML cấp cao nhất mà Obsidian nhận diện là danh sách văn bản. Tùy chỉnh gợi ý giá trị thường chỉ sắp xếp lại các gợi ý của Obsidian; chế độ tùy chỉnh có thể thêm các giá trị định sẵn qua cùng ô nhập thuộc tính. Các giới hạn cụ thể được trình bày bên dưới.

## Cài đặt

### Qua plugin cộng đồng (khuyến nghị)

Trong Obsidian, mở **Cài đặt → Plugin cộng đồng → Duyệt**, tìm **Property Order**, rồi chọn **Cài đặt** và **Bật**. Bạn cũng có thể mở [trang Plugin cộng đồng](https://obsidian.md/plugins?id=property-order) của plugin. Chỉ dùng hướng dẫn ZIP bên dưới nếu cần cài đặt thủ công.

### Cài đặt thủ công

Tải `property-order-<version>.zip` từ [bản phát hành mới nhất](https://github.com/ZHYX91/obsidian-property-order/releases/latest) và giải nén vào `Vault/.obsidian/plugins/`. Tệp nén chứa thư mục `property-order/` với `main.js`, `manifest.json` và `styles.css`. Tải lại Obsidian, rồi bật Property Order trong phần Plugin cộng đồng.

### Nâng cấp

Nếu có `Vault/.obsidian/plugins/property-order/data.json`, hãy sao lưu và giữ lại tệp này. Chỉ thay thế `main.js`, `manifest.json` và `styles.css`. Chỉ xóa `data.json` khi bạn thực sự muốn đặt lại toàn bộ tùy chọn của plugin.

## Cách sử dụng

1. Bật Property Order trong **Cài đặt → Plugin cộng đồng**.
2. Mở một ghi chú có thuộc tính danh sách YAML cấp cao nhất trong phần Thuộc tính của Obsidian.
3. Trên máy tính, kéo trực tiếp một giá trị. Trên thiết bị di động, nhấn giữ giá trị, chọn **Sắp xếp lại** hoặc **Sắp xếp lại hoặc di chuyển**, rồi kéo giá trị đó.
4. Cấu hình **Gợi ý tên thuộc tính** cho các tên được gợi ý. Nếu cần, bật **Gợi ý giá trị thuộc tính** để sắp xếp các giá trị có sẵn của Obsidian bằng cài đặt mặc định và quy tắc riêng cho từng thuộc tính.

**Nên dùng phần cài đặt gợi ý nào?** Khi thêm thuộc tính mới và nhập **tên**, **Gợi ý tên thuộc tính** quyết định việc ghim, ẩn hoặc sắp xếp các tên như `status` hay `owner`. Sau khi chọn `status` và chỉnh **giá trị**, **Gợi ý giá trị thuộc tính** quyết định các giá trị có sẵn như `todo` hay `done`, cùng những giá trị định sẵn do bạn thêm. Tùy chỉnh gợi ý giá trị được tắt mặc định. Cả hai phần cài đặt đều không thay đổi ghi chú cho đến khi bạn chọn hoặc sửa một giá trị.

**Ví dụ: thêm các giá trị thường dùng cho `status`.** Mở **Gợi ý giá trị thuộc tính**, bật **Tùy chỉnh gợi ý giá trị thuộc tính** và thêm thẻ quy tắc **Gợi ý tùy chỉnh**. Thêm `status` vào thẻ đó. Trong **Gợi ý ghim ở đầu**, nhập `todo` rồi chọn **Thêm giá trị định sẵn**; làm tương tự với `doing` và `done`. Khi chỉnh `status`, các giá trị này sẽ xuất hiện và được lọc theo nội dung bạn nhập. Để một giá trị định sẵn tuân theo thứ tự sắp xếp thông thường, nhấn **↔ (Chuyển về gợi ý thông thường)** bên cạnh giá trị đó.

## Các mục cài đặt

Mọi phiên bản Obsidian được hỗ trợ đều sử dụng cùng bốn thẻ cài đặt:

- **Chung**: chọn ngôn ngữ plugin và bật thông báo chẩn đoán nếu cần. Giao diện và README có tiếng Anh, tiếng Trung giản thể, tiếng Trung phồn thể, tiếng Đức, tiếng Pháp, tiếng Tây Ban Nha, tiếng Bồ Đào Nha Brazil, tiếng Nga, tiếng Nhật, tiếng Hàn, tiếng Việt và tiếng Ả Rập. **Theo Obsidian** dùng ngôn ngữ tương ứng, hoặc tiếng Anh nếu chưa hỗ trợ ngôn ngữ đó.
- **Thứ tự giá trị**: chọn định dạng danh sách sau khi kéo, di chuyển giữa các thuộc tính và cách kéo. Tắt kéo giá trị không xóa tùy chọn di chuyển giữa các thuộc tính.
- **Gợi ý tên thuộc tính**: chọn tên ghim ở đầu, đặt ở cuối, cần ẩn và cách sắp xếp theo tên, dùng gần đây hoặc số ghi chú. **Nhóm gợi ý theo kiểu thuộc tính** chia các gợi ý thông thường thành Văn bản, Danh sách, Số, Hộp kiểm, Ngày, Ngày và giờ, Thẻ, Tự động / chưa chỉ định. Cách sắp xếp đã chọn vẫn áp dụng trong từng nhóm.
- **Gợi ý giá trị thuộc tính**: chỉ hoạt động khi được bật. Thuộc tính chưa cấu hình riêng dùng một cách hiển thị mặc định. Bạn có thể chỉ định từng tên thuộc tính để dùng Theo tên, Số lần chọn, Số ghi chú, Thứ tự Obsidian, Không hiển thị gợi ý hoặc Gợi ý tùy chỉnh.
- Quy tắc gợi ý tùy chỉnh có ba phần: ghim ở đầu, thông thường và đặt ở cuối. Có thể nhập trực tiếp giá trị định sẵn để chúng vẫn được chọn ngay cả trước khi xuất hiện trong ghi chú.
- **Thứ tự thuộc tính trên trang cài đặt này** chỉ thay đổi thứ tự trong thẻ quy tắc và trình chỉnh sửa gợi ý tùy chỉnh. Không thay đổi thứ tự thuộc tính trong ghi chú hay các giá trị được gợi ý.
- Lịch sử tên thuộc tính dùng gần đây lưu tối đa 100 tên trên thiết bị hiện tại. Số lần chọn giá trị cũng chỉ lưu trên thiết bị này. Cả hai đều tách khỏi `data.json`, không được đồng bộ và có thể xóa trong cài đặt.

## Giới hạn

- Kéo giá trị chỉ hoạt động với thuộc tính YAML cấp cao nhất được Obsidian hiển thị dưới dạng danh sách văn bản.
- Không hỗ trợ danh sách đối tượng, danh sách lồng nhau, danh sách ngoặc vuông viết trên nhiều dòng, kéo dòng trong chế độ nguồn hoặc di chuyển giữa các tệp.
- Trên thiết bị di động, cần chọn **Sắp xếp lại** hoặc **Sắp xếp lại hoặc di chuyển** từ menu nhấn giữ của Obsidian rồi mới kéo. Các thao tác gốc như Sửa, Xóa khỏi danh sách và Sao chép vẫn dùng được.
- Một số hàng báo không khớp kiểu vẫn có thể dùng nếu Obsidian nhận diện rõ đó là thuộc tính danh sách. Các hàng trộn nhiều giá trị khó xác định sẽ được xử lý thận trọng và có thể chỉ cho phép thêm giá trị vào cuối.
- Giá trị định sẵn chỉ được gợi ý khi chỉnh giá trị trong phần Thuộc tính. Nếu Obsidian không mở danh sách gợi ý, Property Order có thể hiển thị chúng bên cạnh ô nhập. Nếu không nhận diện được ô nhập một cách an toàn, bạn vẫn có thể nhập bình thường.
- Chuyển danh sách mỗi mục một dòng sang ngoặc vuông có thể làm mất các chú thích hoặc dòng trống mà cú pháp ngoặc vuông không biểu diễn được.
- Hiện chưa thể sắp xếp trực tiếp các giá trị thuộc tính chỉ bằng bàn phím. Kéo bằng con trỏ có thông báo trạng thái cho trình đọc màn hình.

## Quyền riêng tư và bảo mật

Property Order hoạt động cục bộ. Plugin không yêu cầu tài khoản, không tải nội dung ghi chú lên mạng và không gọi dịch vụ từ xa.

Kéo chỉ thay đổi các thuộc tính liên quan đến lần di chuyển đó. Plugin kiểm tra kết quả trước khi yêu cầu Obsidian lưu ghi chú và không ghi vào những cấu trúc mà nó không thể xử lý an toàn.

Khi sắp xếp theo số ghi chú, Property Order duyệt danh sách tệp Markdown và đọc thông tin thuộc tính đã được Obsidian lưu trong bộ nhớ đệm; không đọc phần nội dung của từng ghi chú. Lịch sử tên thuộc tính dùng gần đây và số lần chọn giá trị đã được xác nhận chỉ nằm trong bộ nhớ cục bộ riêng cho từng kho trên thiết bị hiện tại, tách khỏi `data.json`, và có thể xóa trong cài đặt.

## Phát triển

Dùng Node.js 24.19.0 và npm 11.17.0. Cài các phiên bản thư viện được ghi trong `package-lock.json`, rồi chạy toàn bộ kiểm tra của kho mã:

```bash
npm ci
npm run check
```

### Tài liệu

- [Yêu cầu sản phẩm (English)](../product-requirements.en.md)
- [Đặc tả UX (English)](../ux-spec.en.md)
- [Kiến trúc (English)](../architecture.en.md)
- [Chiến lược kiểm thử (English)](../testing-strategy.en.md)
- [Nhật ký thay đổi (English)](../../CHANGELOG.md)
- [Hướng dẫn đóng góp (English)](../../CONTRIBUTING.md)
- [Chính sách bảo mật (English)](../../SECURITY.md)

## Hỗ trợ

- [Q&A](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a): câu hỏi về cách dùng và cấu hình.
- [Ideas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas): ý tưởng ban đầu về tính năng và quy trình làm việc.
- [Show and tell](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell): chia sẻ mẹo, quy trình làm việc và cách triển khai tham khảo.
- Dùng [biểu mẫu GitHub Issue](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) có cấu trúc cho lỗi có thể tái hiện và yêu cầu tính năng cụ thể.
- Báo cáo lỗ hổng riêng tư theo [chính sách bảo mật](https://github.com/ZHYX91/obsidian-property-order/security/policy) của kho mã.

Trước khi đăng công khai, hãy xóa đường dẫn kho riêng tư, nội dung ghi chú, giá trị YAML và thông tin xác thực.

## Giấy phép

[MIT](../../LICENSE) © ZhengYX
