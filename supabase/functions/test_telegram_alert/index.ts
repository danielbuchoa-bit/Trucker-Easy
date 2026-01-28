import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!telegramBotToken || !telegramChatId) {
    return new Response(JSON.stringify({ 
      error: 'Telegram not configured',
      hasToken: !!telegramBotToken,
      hasChatId: !!telegramChatId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  try {
    // Send test notification
    const testMessage = `🧪 <b>TESTE - Nova Assinatura!</b>\n\n` +
      `📧 <b>Email:</b> teste@exemplo.com\n` +
      `📦 <b>Plano:</b> DIAMOND\n` +
      `🆔 <b>User ID:</b> test-user-123\n` +
      `📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n` +
      `✅ <i>Este é um alerta de teste!</i>`;

    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: testMessage,
        parse_mode: 'HTML',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[test_telegram] Telegram error:', result);
      return new Response(JSON.stringify({ 
        success: false, 
        error: result 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log('[test_telegram] Test notification sent successfully');
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Test notification sent to Telegram!' 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[test_telegram] Error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
