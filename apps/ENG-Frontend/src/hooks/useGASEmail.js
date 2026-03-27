import { useState, useCallback, useRef, useEffect } from 'react';
import { GAS_WEBAPP_URL } from '../constance/constance';

/**
 * useGASEmail – Custom hook for sending email notifications via Google Apps Script (GAS).
 *
 * Uses a Hybrid approach: 
 * 1. Popup Window for first-time use (bypass Google X-Frame-Options Auth block)
 * 2. Hidden Iframe for subsequent uses (fast and silent, checks localStorage)
 */
const useGASEmail = (onResult) => {
    const [isSending, setIsSending] = useState(false);
    const [iframeUrl, setIframeUrl] = useState(null);
    const popupRef = useRef(null);
    const timeoutRef = useRef(null);

    // แก้ไข: เพิ่มการตรวจจับข้อความ postMessage จาก Google Apps Script
    useEffect(() => {
        console.log('[useGASEmail] Setting up message listener');
        const handleMessage = (event) => {
            if (!event.origin.includes("google.com") && !event.origin.includes("googleusercontent.com")) {
                return;
            }

            const data = event.data;
            if (data && data.type === 'GAS_MAIL_RESULT') {
                console.log('[useGASEmail] Processed GAS_MAIL_RESULT:', data);
                setIsSending(false);
                setIframeUrl(null);

                if (timeoutRef.current) clearTimeout(timeoutRef.current);

                // หากสำเร็จ ให้จดจำไว้ในเครื่องว่าเคยกดยอมรับเรียบร้อยแล้ว
                if (data.status === 'success') {
                    localStorage.setItem('gas_email_authorized', 'true');
                }

                if (onResult) onResult(data);

                // สั่งปิด Popup window หากยังเปิดค้างอยู่
                if (popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onResult]);

    const triggerEmail = useCallback((params = {}) => {
        if (isSending) return;
        if (!params.funct) params.funct = 'sendNotificationEmail';

        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value);
        });
        queryParams.append('t', Date.now());

        const url = `${GAS_WEBAPP_URL}?${queryParams.toString()}`;
        setIsSending(true);

        // เช็คว่าเคยกดยอมรับสิทธิ์ไปแล้วหรือยังผ่าน Local Storage
        const isAuthorized = localStorage.getItem('gas_email_authorized') === 'true';

        if (isAuthorized) {
            // 🔥 หากเคยยอมรับแล้ว -> ซ่อนหน้าต่างเงียบๆ ด้วย Iframe (ไม่ต้องกวนใจเปิด Popup อีกรอบ)
            console.log('[useGASEmail] Using Hidden Iframe mode (Already Authorized)');
            setIframeUrl(url);

            // เซฟตี้: ถ้า Iframe ค้างเกิน 8 วินาที แสดงว่าสิทธิ์ Auth อาจจะหมดอายุ ให้เด้งออกและลบสิทธิ์ทิ้ง
            timeoutRef.current = setTimeout(() => {
                console.warn('[useGASEmail] Iframe timeout (Auth might have expired). Resetting auth status.');
                localStorage.removeItem('gas_email_authorized');
                setIsSending(false);
                setIframeUrl(null);
                if (onResult) {
                    onResult({ status: 'error', message: 'เซสชันการส่งหมดอายุ กรุณากดปุ่มส่งใหม่อีกครั้งเพื่อยืนยันตัวตน' });
                }
            }, 8000);

        } else {
            // 🚨 หากยังไม่เคยส่งเลย หรือเซสชันหมดอายุ -> เปิด Popup เพื่อให้กดยอมรับหน้าจอผู้ใช้
            console.log('[useGASEmail] Using Popup mode for Initial Authorization');
            const width = 600;
            const height = 650;
            const left = (window.innerWidth / 2) - (width / 2) + window.screenX;
            const top = (window.innerHeight / 2) - (height / 2) + window.screenY;

            popupRef.current = window.open(
                url,
                "GAS_Email_Notifier",
                `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,scrollbars=yes`
            );

            // ตรวจเช็คกรณีผู้ใช้เปลี่ยนใจ กดกากบาททิ้งก่อนตอบตกลงยอมรับสิทธิ์
            const checkClosedInterval = setInterval(() => {
                if (popupRef.current && popupRef.current.closed) {
                    clearInterval(checkClosedInterval);
                    setIsSending((prevSending) => {
                        if (prevSending) {
                            if (onResult) {
                                onResult({ status: 'error', message: 'หน้าต่างการอนุญาตถูกปิดก่อนดำเนินรายการสำเร็จ' });
                            }
                            return false;
                        }
                        return prevSending;
                    });
                }
            }, 1000);
        }

    }, [isSending, onResult]);

    // เคลียร์ค่าที่หลงเหลือ
    const cleanup = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
        }
    }, []);

    const IframeRenderer = () => {
        if (!iframeUrl) return null;
        return (
            <iframe
                src={iframeUrl}
                title="gas-email-notifier-hidden"
                style={{ display: 'none', position: 'absolute', left: '-9999px' }}
            />
        );
    };

    return {
        triggerEmail,
        isSending,
        IframeRenderer,
        cleanup,
    };
};

export default useGASEmail;
