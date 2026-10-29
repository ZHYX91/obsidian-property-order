# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Quản lý gợi ý và giá trị danh sách trong bảng Thuộc tính của Obsidian.

- **[Gợi ý tên thuộc tính](#gợi-ý-tên-thuộc-tính)**: ghim, ẩn, nhóm và sắp xếp các tên như `status`, `owner` khi thêm thuộc tính.
- **[Gợi ý giá trị thuộc tính](#gợi-ý-giá-trị-thuộc-tính)**: chọn cách gợi ý giá trị cho từng thuộc tính, kể cả các giá trị định sẵn như `todo`, `doing`, `done`.
- **[Sắp xếp và di chuyển giá trị danh sách](#sắp-xếp-và-di-chuyển-giá-trị-danh-sách)**: dùng thao tác kéo hoặc bảng lệnh để đổi thứ tự các mục hay chuyển chúng giữa các thuộc tính được hỗ trợ trong cùng một ghi chú.

Đây là các tính năng độc lập. Property Order quản lý gợi ý và giá trị danh sách; không sắp xếp lại các trường thuộc tính trong ghi chú. Yêu cầu Obsidian 1.12.7 trở lên, trên máy tính hoặc thiết bị di động.

## Gợi ý tên thuộc tính

Giúp bạn dễ tìm các tên thường dùng trong gợi ý **Thêm thuộc tính** gốc của Obsidian.

1. Mở **Cài đặt → Property Order → Gợi ý tên thuộc tính**.
2. Ghim các tên thường dùng ở đầu, đặt tên ít dùng ở cuối và ẩn tên không cần thiết bằng tên chính xác hoặc quy tắc ký tự đại diện.
3. Chọn sắp xếp theo tên, dùng gần đây hoặc số ghi chú. Tùy chọn **Nhóm gợi ý theo kiểu thuộc tính** nhóm các gợi ý thông thường theo kiểu Obsidian, đồng thời giữ tên được ghim ở đầu và tên đặt ở cuối đúng vị trí.

Ví dụ, ghim `status` và `owner`, rồi ẩn `legacy_code`. Mở **Thêm thuộc tính** trong một ghi chú để xem kết quả. Các quy tắc này chỉ tổ chức những tên Obsidian đã cung cấp; ghim tên không tạo gợi ý mới hay di chuyển trường trong ghi chú.

Gợi ý tên thuộc tính gốc trước khi áp dụng quy tắc:

![Gợi ý tên thuộc tính gốc trước khi tùy chỉnh](../assets/property-order-key-suggestions-before.png)

Cùng các gợi ý đó sau khi ghim tên thường dùng và ẩn tên không cần thiết:

![Gợi ý tên thuộc tính với status và owner được ghim, legacy_code bị ẩn](../assets/property-order-key-suggestions-after.png)

Dùng gần đây là thứ tự các lần thêm đã được xác nhận, không tính rê chuột hay duyệt gợi ý. Sắp xếp theo tên và dùng gần đây không quét Vault. Số ghi chú đếm các ghi chú Markdown chứa từng thuộc tính bằng siêu dữ liệu đã lưu trong bộ nhớ đệm.

## Gợi ý giá trị thuộc tính

Quản lý các giá trị được gợi ý sau khi chọn thuộc tính, chẳng hạn `todo` và `done` cho `status`. Tính năng này **tắt theo mặc định** và độc lập với gợi ý tên thuộc tính.

1. Mở **Cài đặt → Property Order → Gợi ý giá trị thuộc tính** và bật **Tùy chỉnh gợi ý giá trị thuộc tính**.
2. Đặt hành vi mặc định cho các thuộc tính chưa được gán quy tắc, hoặc gán theo tên thuộc tính khớp chính xác: Thứ tự Obsidian, Theo tên, Số lần chọn, Số ghi chú chứa giá trị, Không hiển thị gợi ý hoặc Gợi ý tùy chỉnh.
3. Để tạo danh sách dùng lại cho `status`, thêm thẻ quy tắc **Gợi ý tùy chỉnh**, thêm `status`, rồi dùng **Thêm giá trị định sẵn** để nhập `todo`, `doing`, `done`.

![Các giá trị status định sẵn xuất hiện khi chỉnh sửa giá trị thuộc tính](../assets/property-order-value-suggestions.png)

Gợi ý tùy chỉnh có ba phần: ghim ở đầu, thông thường và đặt ở cuối. Giá trị được khai báo rõ ràng vẫn có sẵn ngay cả khi chưa có ghi chú nào dùng, và được lọc theo nội dung bạn nhập. **↔ (Chuyển về gợi ý thông thường)** bỏ vị trí cố định nhưng vẫn giữ giá trị trong gợi ý; xóa giá trị định sẵn khỏi cài đặt không xóa nội dung ghi chú.

Số lần chọn chỉ tăng khi Obsidian xác nhận giá trị đã được ghi. Số ghi chú đếm các ghi chú Markdown chứa giá trị đó, không phải số lần bạn chọn. **Không hiển thị gợi ý** vẫn cho phép nhập thủ công. Chỉ thay đổi quy tắc gợi ý không chỉnh sửa ghi chú.

## Sắp xếp và di chuyển giá trị danh sách

Đổi thứ tự giá trị danh sách văn bản YAML cấp cao nhất được hỗ trợ ngay trong bảng Thuộc tính, hoặc chuyển giá trị sang thuộc tính danh sách khác trong cùng ghi chú. Kéo giữa các thuộc tính được bật theo mặc định và có thể tắt trong **Thứ tự giá trị**.

![Di chuyển giá trị giữa các thuộc tính](../assets/property-order-cross-property-drag.gif)

- **Máy tính:** kéo giá trị đến vị trí mới hoặc thuộc tính danh sách khác được hỗ trợ.
- **Thiết bị di động:** nhấn giữ giá trị, chọn **Sắp xếp lại** hoặc **Sắp xếp lại hoặc di chuyển** trong menu gốc của Obsidian, rồi kéo giá trị đó. Nếu không thể mở rộng menu, chức năng chỉnh sửa gốc vẫn dùng được và plugin không thay bằng menu mô phỏng.
- **Bàn phím:** chạy **Property Order: Sắp xếp lại giá trị thuộc tính** từ bảng lệnh. Chọn thuộc tính nguồn và giá trị, rồi chuyển lên, xuống, đến vị trí tính từ 1, đầu/cuối danh sách hoặc cuối thuộc tính khác. Không có phím tắt mặc định. Lệnh vẫn hoạt động khi tắt kéo; tùy chọn kéo giữa các thuộc tính chỉ áp dụng cho thao tác kéo bằng con trỏ.

Mỗi lần đổi thứ tự hay di chuyển hoàn tất là một chỉnh sửa có thể hoàn tác bằng một bước. Trước khi cập nhật bắt đầu, **Escape** hoặc **Hủy** giữ nguyên ghi chú. Khi đã bắt đầu, hãy đợi hoàn tất rồi dùng Hoàn tác trong trình soạn thảo nếu cần. Kéo hỗ trợ giá trị xuống dòng, giao diện từ phải sang trái, cuộn gần các cạnh bảng được hỗ trợ và thông báo trạng thái cho trình đọc màn hình.

**Kiểm tra kiểu giá trị trước khi sắp xếp:** các mục không phải văn bản trong danh sách văn bản được hỗ trợ có thể thành chuỗi, chẳng hạn `true` thành `"true"` và `123` thành `"123"`. Vì vậy kiểu dữ liệu cũng có thể thay đổi; hãy kiểm tra kết quả nếu kiểu số hoặc boolean có ý nghĩa với bạn.

**Mặc định giữ nguyên định dạng danh sách.** Bạn có thể chọn danh sách trong ngoặc vuông hoặc mỗi mục một dòng trong **Thứ tự giá trị**. Chuyển sang ngoặc vuông có thể làm mất chú thích hoặc dòng trống; hãy giữ nguyên định dạng nếu cần giữ chúng. Mở **Ví dụ định dạng** bên cạnh **Định dạng danh sách sau khi sắp xếp** để so sánh các lựa chọn.

## Cài đặt

### Qua plugin cộng đồng (khuyến nghị)

Trong Obsidian, mở **Cài đặt → Plugin cộng đồng → Duyệt**, tìm **Property Order**, rồi chọn **Cài đặt** và **Bật**. Bạn cũng có thể mở [trang Plugin cộng đồng](https://obsidian.md/plugins?id=property-order) của plugin. Chỉ dùng hướng dẫn ZIP bên dưới nếu cần cài đặt thủ công.

### Cài đặt thủ công

Tải `property-order-<version>.zip` từ [bản phát hành mới nhất](https://github.com/ZHYX91/obsidian-property-order/releases/latest) và giải nén vào `Vault/.obsidian/plugins/`. Tệp nén chứa thư mục `property-order/` với `main.js`, `manifest.json` và `styles.css`. Tải lại Obsidian, rồi bật Property Order trong phần Plugin cộng đồng.

### Nâng cấp

Nếu có `Vault/.obsidian/plugins/property-order/data.json`, hãy sao lưu và giữ lại tệp này. Chỉ thay thế `main.js`, `manifest.json` và `styles.css`. Chỉ xóa `data.json` khi bạn thực sự muốn đặt lại toàn bộ tùy chọn của plugin.

## Tham khảo cài đặt

Mọi phiên bản Obsidian được hỗ trợ đều sử dụng cùng bốn thẻ:

| Thẻ | Nội dung điều khiển |
| --- | --- |
| **Chung** | Ngôn ngữ plugin và thông báo chẩn đoán tùy chọn. **Theo Obsidian** dùng ngôn ngữ tương ứng, hoặc tiếng Anh nếu không có. |
| **Thứ tự giá trị** | Kéo trong cùng thuộc tính, kéo giữa các thuộc tính và định dạng danh sách sau khi sắp xếp. Tắt kéo không xóa tùy chọn riêng cho kéo giữa các thuộc tính. |
| **Gợi ý tên thuộc tính** | Ghim đầu, đặt cuối, ẩn tên; sắp xếp theo tên, dùng gần đây, số ghi chú; nhóm theo kiểu tùy chọn; xóa lịch sử gần đây và ô thử quy tắc. |
| **Gợi ý giá trị thuộc tính** | Hành vi mặc định cần chủ động bật, quy tắc theo thuộc tính, giá trị định sẵn và xóa số lần chọn. |

**Thứ tự thuộc tính trên trang cài đặt này** chỉ sắp xếp các thuộc tính trong thẻ quy tắc và trình chỉnh sửa tùy chỉnh. Nó không thay đổi các trường trong ghi chú hoặc thứ tự gợi ý giá trị.

Giao diện và README hỗ trợ tiếng Anh, Trung giản thể, Trung phồn thể, Đức, Pháp, Tây Ban Nha, Bồ Đào Nha (Brazil), Nga, Nhật, Hàn, Việt và Ả Rập.

## Khả năng tương thích và giới hạn

- Kéo giá trị hỗ trợ các dòng thuộc tính YAML cấp cao nhất thông thường được Obsidian hiển thị dưới dạng danh sách văn bản. Không hỗ trợ ánh xạ toàn tài liệu trong `{ ... }`, danh sách đối tượng, danh sách lồng nhau, danh sách trong ngoặc trải trên nhiều dòng, kéo dòng ở chế độ nguồn hoặc chuyển giữa các tệp.
- Giá trị rỗng hay đơn có thể tham gia nếu Obsidian nhận diện thuộc tính là danh sách. Một số hàng không khớp kiểu cũng hoạt động nếu từng giá trị được phân biệt rõ. Hàng chứa giá trị hỗn hợp mơ hồ được xử lý thận trọng và có thể chỉ nhận giá trị thêm vào cuối.
- Lệnh bàn phím cần bảng Thuộc tính hiển thị và được hỗ trợ trong ngăn Markdown đang hoạt động. Nếu tệp hay giá trị thay đổi khi hộp thoại đang mở, hãy mở lại lệnh.
- Giá trị định sẵn chỉ xuất hiện khi chỉnh sửa giá trị trong bảng Thuộc tính. Nếu không có cửa sổ gợi ý gốc, plugin có thể hiển thị chúng cạnh ô nhập. Nếu không nhận diện an toàn được trình soạn thảo hay giao diện gợi ý gốc, bạn vẫn có thể nhập bình thường hoặc dùng gợi ý gốc.
- Tính năng đổi thứ tự kiểm tra YAML trước khi yêu cầu Obsidian lưu. Nội dung không được hỗ trợ hoặc có xung đột được giữ nguyên. Chọn hay chỉnh sửa thuộc tính trong Obsidian có thể thay đổi ghi chú; chỉ cấu hình gợi ý thì không.

## Quyền riêng tư và bảo mật

Property Order hoạt động cục bộ. Không cần tài khoản, không tải nội dung ghi chú lên và không gọi dịch vụ từ xa. Đổi thứ tự hoặc di chuyển giá trị chỉ thay đổi các thuộc tính liên quan.

Số ghi chú dùng siêu dữ liệu frontmatter trong bộ nhớ đệm thay vì đọc nội dung từng ghi chú. Lịch sử tên thuộc tính gần đây (tối đa 100 tên) và số lần chọn giá trị đã xác nhận chỉ nằm trong bộ nhớ cục bộ của Vault trên thiết bị hiện tại, tách biệt với `data.json`. Chúng không được đồng bộ và có thể xóa từ cài đặt. Rê chuột, duyệt, hủy và các chỉnh sửa chưa được xác nhận không cập nhật chúng.

## Phát triển và hỗ trợ

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

- [Q&A](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a): câu hỏi về cách dùng và cấu hình.
- [Ideas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas): ý tưởng ban đầu về tính năng và quy trình làm việc.
- [Show and tell](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell): chia sẻ mẹo, quy trình làm việc và cách triển khai tham khảo.
- Dùng [biểu mẫu GitHub Issue](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) có cấu trúc cho lỗi có thể tái hiện và yêu cầu tính năng cụ thể.
- Báo cáo lỗ hổng riêng tư theo [chính sách bảo mật](https://github.com/ZHYX91/obsidian-property-order/security/policy) của kho mã.

Trước khi đăng công khai, hãy xóa đường dẫn kho riêng tư, nội dung ghi chú, giá trị YAML và thông tin xác thực.

## Giấy phép

[MIT](../../LICENSE) © ZhengYX
