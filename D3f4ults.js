const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const express = require("express");
require('dotenv').config();

// Fetch fallback for Node < 18
let fetch = global.fetch;
if (!fetch) {
    fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

// ==== START: Webserver für UptimeRobot ====
const app = express();
const PORT = process.env.PORT || 3001; // Using different port than TicketBot

app.get("/", (req, res) => {
  res.send("D3f Bot is running!");
});

app.listen(PORT, () => {
  console.log('\n=== UPTIME ROBOT SETUP ===');
  console.log('Add this URL to UptimeRobot:');
  console.log(`🔗 https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
  console.log('========================\n');
});
// ==== END: Webserver für UptimeRobot ====

// Create bot with comprehensive intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    // Add these lines for more robust connection
    ws: {
        properties: {
            $browser: "Discord iOS"
        }
    }
});

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const updateWebhookUrl = process.env.UPDATE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1408042991695826954/8kz-zZfDChy_xNkxw8WwupMYst0Ykt_Hbi1Nh0ecwdlYuATcNXV6eiwParSTGbZHFLLu';
const updateTestOnBoot = String(process.env.UPDATE_TEST_ON_BOOT || 'false').toLowerCase() === 'true';

// Permission config
const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
const allowedUserId = '972533051173240875';

// Track users waiting to input rules messages
const waitingForRulesMessage = new Map();

// Check if a user has permission to use restricted commands
function hasPermission(member) {
    // Check if the user has the specific ID
    if (member.user.id === allowedUserId) {
        return true;
    }
    
    // Check if the user has administrator permission
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

// Überprüfe ob Token und Client ID vorhanden sind
if (!token || !clientId) {
    console.error('❌ Fehler: DISCORD_TOKEN oder CLIENT_ID fehlt in den Umgebungsvariablen!');
    process.exit(1);
}

// Define Slash Commands (only rules and msg)
const commands = [
    new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Sets up a rules message with verification buttons (requires special role)')
        .addRoleOption(option =>
            option.setName('verification_role')
                .setDescription('The role to give when users accept the rules')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('msg')
        .setDescription('Send a message to a selected channel (requires special role)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send the message to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message content to send')
                .setRequired(true)
        )
];

// Zusätzliche Fehlerbehandlung für Client-Verbindung
client.on('error', (error) => {
    console.error('Discord Client Error:', error);
});

client.on('warn', (warning) => {
    console.warn('Discord Client Warning:', warning);
});

client.on('disconnect', (event) => {
    console.error(`Discord disconnected with code ${event.code}. Reason: ${event.reason}`);
});

// Verbesserte Ready-Ereignisbehandlung
client.once('ready', async () => {
    console.log(`\n=== BOT STARTUP ===`);
    console.log(`✅ Bot is online as ${client.user.tag}!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    console.log(`🌐 Bot User ID: ${client.user.id}`);
    console.log(`==================\n`);
    
    // Zusätzliche Diagnose-Informationen
    client.guilds.cache.forEach(guild => {
        console.log(`Server: ${guild.name} (ID: ${guild.id})`);
    });
    
    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Registering Slash Commands...');
        let data;
        if (guildId) {
            console.log(`Using guild registration for faster updates (GUILD_ID=${guildId}).`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
        } else {
            console.log('No GUILD_ID set. Registering commands globally (may take up to 1h to propagate).');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
        }
        console.log(`✅ Successfully registered ${data.length} slash commands!`);
        console.log('Registered commands:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('Error registering commands:', error);
        if (error.requestBody) {
            console.error('Request Details:', {
                body: error.requestBody,
                code: error.code,
                status: error.status,
                method: error.method
            });
        }
    }

    // Start Roblox update checker after bot is ready
    try {
        startRobloxUpdateWatcher();
        console.log('✅ Roblox update watcher started');
    } catch (e) {
        console.error('Failed to start Roblox update watcher:', e);
    }

    // Optional: test webhook on boot
    if (updateTestOnBoot) {
        const simulatedVersion = `test-${Date.now()}`;
        console.log('🚀 UPDATE_TEST_ON_BOOT=true -> sending test update to webhook:', simulatedVersion);
        await postUpdateToWebhook(simulatedVersion);
    }
});

// Event for Slash Commands
client.on('interactionCreate', async interaction => {
    try {
        console.log(`[interactionCreate] type=${interaction.type} guild=${interaction.guildId} command=${interaction.commandName || ''}`);
        if (!interaction.isChatInputCommand()) return;

        // Check if the interaction is still valid
        if (!interaction.isRepliable()) {
            console.log('Interaction is no longer valid');
            return;
        }

        if (interaction.commandName === 'rules') {
            if (!hasPermission(interaction.member)) {
                console.log(`[rules] missing permission user=${interaction.user.id}`);
                await interaction.reply({ content: 'You don\'t have permission to use this command.', ephemeral: true });
                return;
            }

            // Get the verification role
            const verificationRole = interaction.options.getRole('verification_role');
            
            // Store the user and role in the waiting map
            waitingForRulesMessage.set(interaction.user.id, {
                channelId: interaction.channelId,
                roleId: verificationRole.id,
                timestamp: Date.now() // To potentially expire old requests
            });
            
            // Ask the user to provide the rules message
            await interaction.reply({ 
                content: `Please type your rules message now. Your next message in this channel will be used as the rules content with verification buttons.`,
                ephemeral: true 
            });
        }
        
        if (interaction.commandName === 'msg') {
            if (!hasPermission(interaction.member)) {
                console.log(`[msg] missing permission user=${interaction.user.id}`);
                await interaction.reply({ content: 'You don\'t have permission to use this command.', ephemeral: true });
                return;
            }
            
            const targetChannel = interaction.options.getChannel('channel');
            const messageContent = interaction.options.getString('message');
            
            // Validate channel
            if (!targetChannel || targetChannel.guildId !== interaction.guildId) {
                await interaction.reply({ content: 'Invalid channel.', ephemeral: true });
                return;
            }
            
            if (!targetChannel.isTextBased?.()) {
                await interaction.reply({ content: 'That\'s not a text channel.', ephemeral: true });
                return;
            }
            
            try {
                await targetChannel.send({ content: messageContent });
                await interaction.reply({ content: `Message sent to <#${targetChannel.id}>`, ephemeral: true });
            } catch (error) {
                console.error('Error sending message to channel:', error);
                await interaction.reply({ content: 'Failed to send message. Check my permissions.', ephemeral: true });
            }
        }
    } catch (error) {
        console.error('Error in interactionCreate:', error);
        await interaction.reply({ content: 'Something went wrong. Contact an admin.', ephemeral: true });
    }
});

// Event for Button Interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        try {
            // Handle rule acceptance
            if (interaction.customId.startsWith('accept_rules:')) {
                try {
                    // Extract the role ID from the button custom ID
                    const roleId = interaction.customId.split(':')[1];
                    
                    // Get the verification role
                    const verificationRole = interaction.guild.roles.cache.get(roleId);
                    
                    if (!verificationRole) {
                        await interaction.reply({ content: 'Verification role not found.', ephemeral: true });
                        return;
                    }
                    
                    // Add the role to the user
                    await interaction.member.roles.add(verificationRole);
                    
                    // Send confirmation in the channel
                    await interaction.reply({ content: `Verified! You now have the ${verificationRole.name} role.`, ephemeral: true });
                    
                    // Send DM to the user
                    try {
                        await interaction.user.send({
                            content: `**Verified!**\n\nYou now have the ${verificationRole.name} role in **${interaction.guild.name}**.\n\nFollow the rules or you might get warned. Use the decline button if you change your mind.`
                        });
                    } catch (dmError) {
                        console.error('Could not send DM to user:', dmError);
                    }
                } catch (error) {
                    console.error('Error during verification:', error);
                    await interaction.reply({ content: 'Failed to verify you. Contact an admin.', ephemeral: true });
                }
            }
            
            // Handle rule declination
            if (interaction.customId.startsWith('decline_rules:')) {
                try {
                    // Extract the role ID from the button custom ID
                    const roleId = interaction.customId.split(':')[1];
                    
                    // Get the verification role
                    const verificationRole = interaction.guild.roles.cache.get(roleId);
                    
                    if (verificationRole) {
                        // Remove the role from the user if they have it
                        if (interaction.member.roles.cache.has(verificationRole.id)) {
                            await interaction.member.roles.remove(verificationRole);
                        }
                    }
                    
                    // Send confirmation
                    await interaction.reply({ content: 'Rules declined. Some features may be restricted.', ephemeral: true });
                    
                    // Send DM to the user
                    try {
                        await interaction.user.send({
                            content: `**Rules Declined**\n\nYou declined the rules in **${interaction.guild.name}**.\n\nSome features may be restricted. Verify again if you change your mind.`
                        });
                    } catch (dmError) {
                        console.error('Could not send DM to user:', dmError);
                    }
                } catch (error) {
                    console.error('Error during rule declination:', error);
                    await interaction.reply({ content: 'Something went wrong. Contact an admin.', ephemeral: true });
                }
            }
        } catch (generalError) {
            console.error('General button interaction error:', generalError);
            try {
                await interaction.reply({ content: 'Something went wrong. Try again.', ephemeral: true });
            } catch {
                // Fallback if reply fails
                console.error('Could not send error message');
            }
        }
    }
});

// Message event handler for capturing rules content
client.on('messageCreate', async message => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if this user is waiting to input rules
    const waitingData = waitingForRulesMessage.get(message.author.id);
    if (waitingData && waitingData.channelId === message.channelId) {
        // Remove from waiting list
        waitingForRulesMessage.delete(message.author.id);
        
        // Create verification buttons
        const acceptButtonId = `accept_rules:${waitingData.roleId}`;
        const declineButtonId = `decline_rules:${waitingData.roleId}`;
        
        const acceptButton = new ButtonBuilder()
            .setCustomId(acceptButtonId)
            .setLabel('Accept Rules / Verify')
            .setStyle(ButtonStyle.Success);
            
        const declineButton = new ButtonBuilder()
            .setCustomId(declineButtonId)
            .setLabel('Decline Rules')
            .setStyle(ButtonStyle.Danger);
            
        const row = new ActionRowBuilder()
            .addComponents(acceptButton, declineButton);
            
        try {
            // Delete the user's message if we can
            try {
                await message.delete();
            } catch (deleteError) {
                console.error('Could not delete user message:', deleteError);
                // Continue even if we can't delete the message
            }
            
            // Send the rules message with buttons
            await message.channel.send({
                content: message.content,
                components: [row]
            });
            
            // Confirm to the user
            await message.author.send(`Rules message posted in <#${message.channelId}> with verification buttons.`).catch(() => {});
        } catch (error) {
            console.error('Error posting rules message:', error);
            // Try to notify the user
            await message.channel.send({ 
                content: `Error posting rules message. Try again.`,
                ephemeral: true 
            }).catch(() => {});
        }
    }
    
    // Check if message contains "key" (case insensitive)
    if (message.content.toLowerCase().includes('key')) {
        // Determine content based on role
        const hasRequiredRole = message.member.roles.cache.has('1274092938254876744');

        // Helper to ping user in a channel and delete the message
        async function pingUserInChannel(channelId, userId) {
            try {
                const channel = message.guild?.channels?.cache.get(channelId);
                if (!channel || !channel.isTextBased?.()) return;
                const sent = await channel.send({
                    content: `<@${userId}>`,
                    allowedMentions: { users: [userId] }
                });
                await sent.delete().catch(() => {});
            } catch (err) {
                console.error(`Failed to ping user ${userId} in channel ${channelId}:`, err);
            }
        }

        // Perform pings based on role
        if (hasRequiredRole) {
            // Only ping in key channel
            void pingUserInChannel('1382708528891822203', message.author.id);
        } else {
            // Ping in verify channel and key channel
            void pingUserInChannel('1379545851772272811', message.author.id);
            void pingUserInChannel('1382708528891822203', message.author.id);
        }

        const dmContent = hasRequiredRole
            ? `**Key Access**\n\nGet your key here:\nhttps://discord.com/channels/1274086892765188159/1382708528891822203`
            : `**Verification Required**\n\nVerify yourself first here:\nhttps://discord.com/channels/1274086892765188159/1379545851772272811\n\nThen get your key here:\nhttps://discord.com/channels/1274086892765188159/1382708528891822203`;
        try {
            await message.author.send({ content: dmContent });
        } catch (dmError) {
            console.error('Could not send DM to user:', dmError);
            // Fallback: reply in channel with explanation and same content
            try {
                await message.reply({ 
                    content: `Your DMs are disabled. Posting here instead:\n\n${dmContent}`
                });
            } catch (replyError) {
                console.error('Could not send reply either:', replyError);
            }
        }
    }
});

// Login bot with token
client.login(token);

// Function to format uptime nicely
function formatUptime(uptime) {
    const totalSeconds = Math.floor(uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// =====================
// Roblox Update Watcher
// =====================
const ROBLOX_VERSION_URL = 'https://setup.roblox.com/version';
let lastRobloxVersion = null;

async function fetchRobloxVersion() {
    try {
        const response = await fetch(ROBLOX_VERSION_URL, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        return text.trim();
    } catch (error) {
        console.error('Error fetching Roblox version:', error);
        return null;
    }
}

async function postUpdateToWebhook(newVersion) {
    if (!updateWebhookUrl) {
        console.warn('No UPDATE_WEBHOOK_URL configured');
        return;
    }

    const embed = {
        title: 'Roblox Update Detected',
        description: 'A new Roblox client/build version was detected.',
        color: 0x00AAFF,
        fields: [
            { name: 'Version', value: `\n${newVersion}` },
            { name: 'Source', value: ROBLOX_VERSION_URL }
        ],
        timestamp: new Date().toISOString()
    };

    try {
        const res = await fetch(updateWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed], username: 'Update Tracker' })
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Webhook HTTP ${res.status} ${body}`);
        }
        console.log(`📣 Posted Roblox update ${newVersion} to webhook.`);
    } catch (err) {
        console.error('Failed to post to webhook:', err);
    }
}

function startRobloxUpdateWatcher() {
    // Immediate check on start
    void checkOnce();
    // Then poll every 5 minutes
    const intervalMs = 5 * 60 * 1000;
    setInterval(checkOnce, intervalMs);

    async function checkOnce() {
        const current = await fetchRobloxVersion();
        if (!current) return;
        if (lastRobloxVersion === null) {
            lastRobloxVersion = current;
            console.log(`Roblox current version: ${current}`);
            return;
        }
        if (current !== lastRobloxVersion) {
            console.log(`Roblox version changed: ${lastRobloxVersion} -> ${current}`);
            lastRobloxVersion = current;
            await postUpdateToWebhook(current);
        }
    }
}
