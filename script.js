// Menghasilkan nama room acak
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('nmjY7KLivcQlwOBh');
// Nama room harus diawali dengan 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;


function onSuccess() {};
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // Terhubung ke room dan menerima berbagai 'anggota'
  // terhubung ke room. Server pensinyalan sudah siap.
  room.on('members', members => {
    console.log('MEMBERS', members);
    // Jika kami adalah pengguna kedua yang terhubung ke room, kami akan membuat penawaran
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

//Kirim data pensinyalan melalui Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' memberi tahu kami setiap kali agen ICE perlu mengirimkan a
  // pesan ke peer lain melalui server pensinyalan
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  // Jika pengguna adalah penawar, biarkan acara 'dibutuhkan negosiasi' yang membuat penawaran
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
      
    }
  }

  // Saat aliran jarak jauh tiba, tampilkan di elemen #remoteVideo
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    // Tampilkan video lokal Anda dalam elemen #localVideo
    localVideo.srcObject = stream;
    // Tambahkan aliran Anda untuk dikirim ke rekan yang terhubung
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);

  // Dengarkan data pensinyalan dari Scaledrone
  room.on('data', (message, client) => {
    // Pesan telah dikirim oleh kami
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      // Ini dipanggil setelah menerima tawaran atau jawaban dari rekan lain
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // Saat menerima tawaran mari kita jawab
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      // Tambahkan kandidat ICE baru ke deskripsi jarak jauh koneksi kami
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
} 

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}
