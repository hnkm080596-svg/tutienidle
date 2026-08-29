// Bank câu hỏi Tâm Ma Kiếp (spec dot-pha-loi-kiep §5.3) — viết sẵn theo
// realm: thiên văn, địa lý, đạo lý, kiến thức thế giới Thanh Vân.
// Realm càng cao câu hỏi càng phức tạp. Mỗi câu 4 đáp án, 1 đúng —
// UI shuffle thứ tự hiển thị, correctAnswerIndex là nguồn sự thật.

export interface MindQuestion {
  id: string
  realmId: string
  question: string
  answers: readonly string[]
  correctAnswerIndex: number
}

export const TRIBULATION_MIND_QUESTIONS: readonly MindQuestion[] = [
  // ============ Quán Khí (qi_refining) — 12 câu ============
  {
    id: 'mind_qi_01',
    realmId: 'qi_refining',
    question: 'Linh khí của trời đất buổi bình minh chảy về phương nào?',
    answers: ['Tây', 'Nam', 'Đông', 'Bắc'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_qi_02',
    realmId: 'qi_refining',
    question: '"Đạo pháp tự nhiên" — đạo pháp nên học theo điều gì?',
    answers: ['Sức mạnh của kiếm', 'Vật nuôi trong hang', 'Tiền lệ của tiên nhân', 'Trời đất vận hành'],
    correctAnswerIndex: 3,
  },
  {
    id: 'mind_qi_03',
    realmId: 'qi_refining',
    question: 'Ngũ hành tương sinh: Mộc sinh ra hành nào?',
    answers: ['Hỏa', 'Thổ', 'Kim', 'Thủy'],
    correctAnswerIndex: 0,
  },
  {
    id: 'mind_qi_04',
    realmId: 'qi_refining',
    question: 'Động Thiên của Thanh Vân Tông trồng loại gì?',
    answers: ['Linh thảo', 'Linh mộc', 'Linh khoáng', 'Yêu thú'],
    correctAnswerIndex: 0,
  },
  {
    id: 'mind_qi_05',
    realmId: 'qi_refining',
    question: 'Người tu tiên đầu tiên phải đặt nền móng vững — nền móng đó gọi là gì?',
    answers: ['Đan điền', 'Căn cơ', 'Kiếm tâm', 'Đạo tâm'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_qi_06',
    realmId: 'qi_refining',
    question: 'Khi tâm ma quấy nhiễu, bậc tu hành làm gì đầu tiên?',
    answers: ['Rút kiếm chém', 'Bỏ chạy', 'Tĩnh tâm quán chi', 'Uống đan'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_qi_07',
    realmId: 'qi_refining',
    question: 'Sao Bắc Đẩu trên bầu trời đêm có mấy sao sáng chính?',
    answers: ['Năm', 'Sáu', 'Bảy', 'Chín'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_qi_08',
    realmId: 'qi_refining',
    question: 'Trăng tròn nhất vào ngày âm lịch nào?',
    answers: ['Mùng một', 'Rằm', 'Mùng hai mươi', 'Cuối tháng'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_qi_09',
    realmId: 'qi_refining',
    question: '"Thượng thiện nhược thủy" — bậc thiện cao nhất giống điều gì?',
    answers: ['Lửa', 'Nước', 'Gió', 'Đá'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_qi_10',
    realmId: 'qi_refining',
    question: 'Huyết mạch của dã thú căng tràn nhất khi mùa nào?',
    answers: ['Xuân', 'Hạ', 'Thu', 'Đông'],
    correctAnswerIndex: 3,
  },
  {
    id: 'mind_qi_11',
    realmId: 'qi_refining',
    question: 'Kiếp nạn của kẻ tu tiên không nằm bên ngoài mà nằm ở đâu?',
    answers: ['Trong bạc bẽu nhân tình', 'Trong lòng tham của bản thân', 'Trong thiên lôi', 'Trong yêu ma'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_qi_12',
    realmId: 'qi_refining',
    question: 'Đêm đông chí, mặt trời ở phương nào so với chúng ta?',
    answers: ['Xa nhất phương nam', 'Gần nhất', 'Đứng yên', 'Mất tích'],
    correctAnswerIndex: 0,
  },

  // ============ Trúc Cơ (foundation_establishment) — 16 câu ============
  {
    id: 'mind_fe_01',
    realmId: 'foundation_establishment',
    question: 'Kỳ kinh bát mạch — mạch nào là "hải huyết chi mạch" (kho huyết lớn)?',
    answers: ['Nhâm mạch', 'Đốc mạch', 'Xung mạch', 'Đới mạch'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_fe_02',
    realmId: 'foundation_establishment',
    question: '"Kiều" trong Âm Kiều/Dương Kiều mạch có nghĩa là gì?',
    answers: ['Cầu nối', 'Núi cao', 'Sông lớn', 'Cửa đông'],
    correctAnswerIndex: 0,
  },
  {
    id: 'mind_fe_03',
    realmId: 'foundation_establishment',
    question: 'Nhâm mạch chạy dọc phần nào của thân thể?',
    answers: ['Lưng', 'Mặt trước', 'Sườn trái', 'Sườn phải'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_fe_04',
    realmId: 'foundation_establishment',
    question: 'Đan điền của người tu tiên nằm ở vùng nào?',
    answers: ['Đỉnh đầu', 'Ngực', 'Dưới rốn', 'Bàn tay'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_fe_05',
    realmId: 'foundation_establishment',
    question: 'Trúc Cơ thành công, cảnh giới đầu tiên người tu bước vào gọi là gì?',
    answers: ['Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_fe_06',
    realmId: 'foundation_establishment',
    question: '"Đại đạo tam thiên" — có mấy con đường thông tới đại đạo?',
    answers: ['Một', 'Ba', 'Ba nghìn', 'Vô số'],
    correctAnswerIndex: 2,
  },  {
    id: 'mind_fe_07',
    realmId: 'foundation_establishment',
    question: 'Ngũ hành tương khắc: Kim khắc hành nào?',
    answers: ['Mộc', 'Hỏa', 'Thủy', 'Thổ'],
    correctAnswerIndex: 0,
  },
  {
    id: 'mind_fe_08',
    realmId: 'foundation_establishment',
    question: 'Lôi kiếp giáng xuống thường vào canh giờ nào?',
    answers: ['Sáng sớm', 'Giữa trưa', 'Tối khuya', 'Bất kỳ'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_fe_09',
    realmId: 'foundation_establishment',
    question: '"Thiên đạo vô thân" — thiên đạo ưu ái ai?',
    answers: ['Kẻ mạnh', 'Kẻ hiền lành', 'Không ưu ái ai', 'Người có tiền'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_fe_10',
    realmId: 'foundation_establishment',
    question: 'Yêu đan của Hung Giao Xà kết tụ ở bộ phận nào?',
    answers: ['Răng nanh', 'Đan hạch trong thân', 'Vảy', 'Đuôi'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_fe_11',
    realmId: 'foundation_establishment',
    question: 'Kinh mạch bị tắc, linh khí sẽ làm gì?',
    answers: ['Tự tan', 'Chảy vòng qua', 'Tích tụ gây tổn thương', 'Hóa thành đan'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_fe_12',
    realmId: 'foundation_establishment',
    question: '"Phàm nhân nghịch thiên" — hành vi này thiên đạo đối xử thế nào?',
    answers: ['Ban thưởng', 'Buông tha', 'Giáng kiếp khắc nghiệt', 'Không để ý'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_fe_13',
    realmId: 'foundation_establishment',
    question: 'Tinh tú trên trời đêm xoay quanh ngôi sao nào (bắc cực)?',
    answers: ['Sao Thiên Lang', 'Sao Tử Vi', 'Sao Khai Dương', 'Sao Thất Sát'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_fe_14',
    realmId: 'foundation_establishment',
    question: 'Mười hai can giờ — giờ Tý bắt đầu từ mấy giờ đêm?',
    answers: ['21 giờ', '22 giờ', '23 giờ', 'Nửa đêm'],
    correctAnswerIndex: 2,
  },
  {
    id: 'mind_fe_15',
    realmId: 'foundation_establishment',
    question: 'Trúc Cơ Đan giúp gì khi độ kiếp?',
    answers: ['Tăng sức công kích', 'Vững căn cơ, an thần tĩnh khí', 'Hồi máu', 'Tàng hình'],
    correctAnswerIndex: 1,
  },
  {
    id: 'mind_fe_16',
    realmId: 'foundation_establishment',
    question: '"Thiên địa chi kiều" thông suốt thì linh khí trời đất sẽ thế nào?',
    answers: ['Từ chối người tu', 'Hội tụ tự nhiên', 'Tan biến', 'Hóa lôi'],
    correctAnswerIndex: 1,
  },
]
