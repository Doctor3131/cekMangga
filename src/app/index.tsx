import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  background: '#F7F8F3',
  surface: '#FFFFFF',
  ink: '#173B2A',
  muted: '#607468',
  green: '#286243',
  pale: '#E8F0E7',
  border: '#DCE5DC',
  red: '#9C3D32',
};
const MAX_BYTES = 10 * 1024 * 1024;
type Photo = { uri: string; name: string; mimeType: string };
type Result = 'Matang' | 'Busuk';
type Notice = { title: string; message: string };

function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const reset = () => {
    requestId.current += 1;
    setLoading(false);
    setPhoto(null);
    setResult(null);
    setNotice(null);
  };

  const acceptAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const mimeType = asset.mimeType?.toLowerCase() ?? '';
    const name = asset.fileName ?? `mangga.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
    if (!['image/jpeg', 'image/png'].includes(mimeType)) {
      setNotice({ title: 'Format belum didukung', message: 'Pilih foto berformat JPEG atau PNG.' });
      return;
    }
    if (asset.fileSize == null || asset.fileSize > MAX_BYTES) {
      setNotice({ title: 'Ukuran foto terlalu besar', message: 'Gunakan foto berukuran maksimal 10 MB.' });
      return;
    }
    setNotice(null);
    setResult(null);
    setPhoto({ uri: asset.uri, name, mimeType });
  };

  const choosePhoto = async (source: 'camera' | 'gallery') => {
    setNotice(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          if (!permission.canAskAgain) {
            Alert.alert('Izin kamera diperlukan', 'Aktifkan izin kamera di Pengaturan, atau pilih foto dari galeri.', [
              { text: 'Nanti', style: 'cancel' },
              { text: 'Buka Pengaturan', onPress: () => void Linking.openSettings() },
            ]);
          } else {
            setNotice({ title: 'Izin kamera diperlukan', message: 'Izinkan akses kamera atau pilih foto dari galeri.' });
          }
          return;
        }
      }
      const selected = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
      if (!selected.canceled && selected.assets[0]) acceptAsset(selected.assets[0]);
    } catch {
      setNotice({ title: 'Foto tidak dapat dibuka', message: 'Coba pilih atau ambil foto kembali.' });
    }
  };

  const analyze = async () => {
    if (!photo || loading) return;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (!apiUrl) {
      setNotice({ title: 'Layanan belum dikonfigurasi', message: 'Alamat layanan analisis belum tersedia. Coba lagi nanti.' });
      return;
    }
    if (!__DEV__ && !apiUrl.startsWith('https://')) {
      setNotice({ title: 'Koneksi tidak aman', message: 'Layanan analisis harus menggunakan HTTPS.' });
      return;
    }

    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setLoading(true);
    setNotice(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append('file', { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob);
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/predict`, {
        method: 'POST',
        body,
        signal: controller.signal,
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error('invalid_response');
      }
      if (currentRequest !== requestId.current) return;
      if (response.status === 503 && typeof payload === 'object' && payload !== null && 'code' in payload && payload.code === 'model_not_loaded') {
        setNotice({ title: 'Model belum siap', message: 'Layanan analisis sedang disiapkan. Silakan coba lagi nanti.' });
        return;
      }
      if (!response.ok) throw new Error(response.status >= 500 ? 'server' : 'invalid_response');
      if (typeof payload !== 'object' || payload === null || !('label' in payload) || (payload.label !== 'Matang' && payload.label !== 'Busuk')) {
        throw new Error('invalid_response');
      }
      setResult(payload.label);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      const message = error instanceof Error && error.name === 'AbortError'
        ? { title: 'Koneksi terlalu lama', message: 'Analisis melewati 30 detik. Periksa koneksi lalu coba lagi.' }
        : error instanceof Error && error.message === 'invalid_response'
          ? { title: 'Respons tidak dapat dibaca', message: 'Layanan mengirim respons yang tidak dikenali. Coba lagi nanti.' }
          : error instanceof Error && error.message === 'server'
            ? { title: 'Layanan sedang bermasalah', message: 'Terjadi gangguan pada layanan. Silakan coba lagi nanti.' }
            : { title: 'Tidak dapat terhubung', message: 'Periksa koneksi internet lalu coba lagi.' };
      setNotice(message);
    } finally {
      clearTimeout(timeout);
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandMark}><Text style={styles.brandEmoji}>🥭</Text></View>
          <Text style={styles.brand}>cekMangga</Text>
          <Text style={styles.eyebrow}>KENALI KONDISI BUAH</Text>
          <Text accessibilityRole="header" style={styles.heading}>Cek mangga,{ '\n' }lebih mudah.</Text>
          <Text style={styles.subtitle}>Ambil atau pilih foto untuk mengetahui kondisi mangga.</Text>
        </View>

        <View style={styles.card}>
          {photo ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: photo.uri }} style={styles.preview} accessibilityLabel="Pratinjau foto mangga" />
              <Text style={styles.previewCaption}>Pratinjau foto</Text>
            </View>
          ) : (
            <View style={styles.emptyPreview}>
              <Text style={styles.mangoIllustration}>🥭</Text>
              <Text style={styles.emptyTitle}>Mulai dengan sebuah foto</Text>
              <Text style={styles.emptyDescription}>Pastikan mangga terlihat jelas dan mendapat pencahayaan yang cukup.</Text>
            </View>
          )}

          {notice && <View accessibilityRole="alert" style={styles.notice}><Text style={styles.noticeTitle}>{notice.title}</Text><Text style={styles.noticeText}>{notice.message}</Text></View>}
          {result && <View accessibilityLiveRegion="polite" style={styles.result}><Text style={styles.resultEyebrow}>HASIL PEMERIKSAAN</Text><Text accessibilityRole="header" style={styles.resultTitle}>Mangga {result.toLowerCase()}</Text><Text style={styles.resultText}>Hasil ini berdasarkan tampilan visual foto.</Text></View>}
          {loading && <View accessibilityLiveRegion="polite" style={styles.loading}><ActivityIndicator color={C.green} /><Text style={styles.loadingText}>Sedang menganalisis foto…</Text></View>}

          {photo ? (
            <View style={styles.actions}>
              {!result && <Button label="Analisis foto" onPress={analyze} disabled={loading} />}
              {notice && <Button label="Coba Lagi" onPress={analyze} disabled={loading} secondary />}
              <Button label="Pilih ulang foto" onPress={() => void choosePhoto('gallery')} disabled={loading} secondary />
              {result && <Button label="Scan Lagi" onPress={reset} />}
            </View>
          ) : (
            <View style={styles.actions}>
              <Button label="Ambil foto" onPress={() => void choosePhoto('camera')} />
              <Button label="Pilih dari galeri" onPress={() => void choosePhoto('gallery')} secondary />
            </View>
          )}
        </View>

        <View style={styles.tip}><Text style={styles.tipIcon}>✦</Text><Text style={styles.tipText}>Untuk hasil terbaik, gunakan foto yang terang dan fokus.</Text></View>
        <Text style={styles.disclaimer}>Hasil deteksi visual memiliki keterbatasan dan bukan pengganti pemeriksaan keamanan pangan.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 36 },
  header: { alignItems: 'center', marginBottom: 26 },
  brandMark: { width: 48, height: 48, borderRadius: 18, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  brandEmoji: { fontSize: 26 },
  brand: { color: C.ink, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  eyebrow: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 1.8, marginTop: 26 },
  heading: { color: C.ink, fontSize: 34, lineHeight: 40, fontWeight: '700', textAlign: 'center', marginTop: 9 },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 10, maxWidth: 300 },
  card: { backgroundColor: C.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: C.border, shadowColor: '#183B2A', shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  emptyPreview: { minHeight: 208, borderRadius: 18, backgroundColor: '#F3F6EF', alignItems: 'center', justifyContent: 'center', padding: 22 },
  mangoIllustration: { fontSize: 46, marginBottom: 10 },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyDescription: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7, maxWidth: 265 },
  previewWrap: { alignItems: 'center' },
  preview: { width: '100%', height: 250, borderRadius: 18, backgroundColor: C.pale },
  previewCaption: { color: C.muted, fontSize: 12, marginTop: 9 },
  actions: { gap: 10, marginTop: 16 },
  button: { minHeight: 52, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  buttonSecondaryText: { color: C.ink },
  pressed: { opacity: 0.8 },
  notice: { backgroundColor: '#FFF3EF', borderRadius: 14, padding: 14, marginTop: 14 },
  noticeTitle: { color: C.red, fontSize: 14, fontWeight: '700' },
  noticeText: { color: '#633A34', fontSize: 13, lineHeight: 19, marginTop: 4 },
  result: { backgroundColor: C.pale, borderRadius: 16, padding: 17, marginTop: 15, alignItems: 'center' },
  resultEyebrow: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  resultTitle: { color: C.ink, fontSize: 24, fontWeight: '700', marginTop: 5 },
  resultText: { color: C.muted, fontSize: 13, marginTop: 4 },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  loadingText: { color: C.ink, fontSize: 14 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, marginTop: 20 },
  tipIcon: { color: C.green, fontSize: 19, fontWeight: '700' },
  tipText: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 18, paddingHorizontal: 8 },
});
