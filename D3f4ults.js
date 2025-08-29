const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const express = require("express");
require('dotenv').config();

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

// Permission config
const allowedUserId = '972533051173240875';

// Track jailed users' previous roles for restoration
const jailedPreviousRoles = new Map();

// Helper: compact status embed
function buildStatusEmbed(message, type = 'success') {
    const color = type === 'success' ? 0x57F287 /* green */
        : type === 'error' ? 0xED4245 /* red */
        : 0x5865F2; /* blurple info */
    const emoji = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    return new EmbedBuilder()
        .setDescription(`${emoji} ${message}`)
        .setColor(color);
}

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

// Helper map for rules message capture
const waitingForRulesMessage = new Map();

// Slash Commands (rules, msg, jail, unjail)
const commands = [
    new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Post a rules message with verify buttons')
        .addRoleOption(option =>
            option.setName('verification_role')
                .setDescription('Role to give on verify')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('msg')
        .setDescription('Send a message to a selected channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Target text channel')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message content')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('jail')
        .setDescription('Jail a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to jail')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason (optional)')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('unjail')
        .setDescription('Unjail a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to unjail')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason (optional)')
                .setRequired(false)
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

        // no other commands

        if (interaction.commandName === 'rules') {
            if (!hasPermission(interaction.member)) {
                await interaction.reply({ embeds: [buildStatusEmbed('No permission.', 'error')], ephemeral: true });
                return;
            }

            const verificationRole = interaction.options.getRole('verification_role');
            waitingForRulesMessage.set(interaction.user.id, {
                channelId: interaction.channelId,
                roleId: verificationRole.id,
                timestamp: Date.now()
            });

            await interaction.reply({
                embeds: [buildStatusEmbed('Send your rules text in this channel. Your next message will be used.', 'info')],
                ephemeral: true
            });
        }

        if (interaction.commandName === 'msg') {
            if (!hasPermission(interaction.member)) {
                await interaction.reply({ embeds: [buildStatusEmbed('No permission.', 'error')], ephemeral: true });
                return;
            }

            const targetChannel = interaction.options.getChannel('channel');
            const messageContent = interaction.options.getString('message');

            if (!targetChannel || targetChannel.guildId !== interaction.guildId) {
                await interaction.reply({ embeds: [buildStatusEmbed('Invalid channel.', 'error')], ephemeral: true });
                return;
            }
            if (!targetChannel.isTextBased?.()) {
                await interaction.reply({ embeds: [buildStatusEmbed('Not a text channel.', 'error')], ephemeral: true });
                return;
            }

            try {
                await targetChannel.send({ content: messageContent });
                await interaction.reply({ embeds: [buildStatusEmbed(`Sent to #${targetChannel.name}.`, 'success')] , ephemeral: true });
            } catch (error) {
                console.error('Error sending message to channel:', error);
                await interaction.reply({ embeds: [buildStatusEmbed('Send failed.', 'error')], ephemeral: true });
            }
        }
        
        if (interaction.commandName === 'jail') {
            if (!hasPermission(interaction.member)) {
                await interaction.reply({ embeds: [buildStatusEmbed('No permission.', 'error')], ephemeral: true });
                return;
            }

            const targetUser = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason') || null;
            const jailRoleId = '1410930206377775185';

            try {
                const guild = interaction.guild;
                const member = await guild.members.fetch(targetUser.id);

                // Validate role manageability
                const me = await guild.members.fetchMe();
                if (member.roles.highest.position >= me.roles.highest.position && guild.ownerId !== me.id) {
                    await interaction.reply({ embeds: [buildStatusEmbed('Role hierarchy.', 'error')], ephemeral: true });
                    return;
                }

                const jailRole = guild.roles.cache.get(jailRoleId);
                if (!jailRole) {
                    await interaction.reply({ embeds: [buildStatusEmbed('Jail role missing.', 'error')], ephemeral: true });
                    return;
                }

                // Store previous roles (excluding @everyone and managed roles)
                const previousRoleIds = member.roles.cache
                    .filter(r => r.id !== guild.id && !r.managed && r.id !== jailRoleId)
                    .map(r => r.id);
                jailedPreviousRoles.set(member.id, previousRoleIds);

                // Set only the jail role (removes others)
                await member.roles.set([jailRoleId]);

                const reasonText = reason ? ` (${reason})` : '';
                await interaction.reply({ embeds: [buildStatusEmbed(`${interaction.user.tag} jailed ${member.user.tag}${reasonText}.`, 'success')], ephemeral: false });
            } catch (err) {
                console.error('Error jailing user:', err);
                try {
                    await interaction.reply({ embeds: [buildStatusEmbed('Jail failed.', 'error')], ephemeral: true });
                } catch {}
            }
        }

        if (interaction.commandName === 'unjail') {
            if (!hasPermission(interaction.member)) {
                await interaction.reply({ embeds: [buildStatusEmbed('No permission.', 'error')], ephemeral: true });
                return;
            }

            const targetUser = interaction.options.getUser('user', true);
            const jailRoleId = '1410930206377775185';
            const mustHaveRoleId = '1274092938254876744';
            const reason = interaction.options.getString('reason') || null;

            try {
                const guild = interaction.guild;
                const member = await guild.members.fetch(targetUser.id);

                // Validate role manageability
                const me = await guild.members.fetchMe();
                if (member.roles.highest.position >= me.roles.highest.position && guild.ownerId !== me.id) {
                    await interaction.reply({ embeds: [buildStatusEmbed('Role hierarchy.', 'error')], ephemeral: true });
                    return;
                }

                const restoreRoles = jailedPreviousRoles.get(member.id) || [];
                // Ensure base role is included
                if (!restoreRoles.includes(mustHaveRoleId)) restoreRoles.push(mustHaveRoleId);

                // roles.set overwrites; include only roles that still exist and are manageable
                const validRoleIds = restoreRoles.filter(roleId => {
                    const role = guild.roles.cache.get(roleId);
                    return !!role && !role.managed && role.editable;
                });

                // If nothing valid, at least ensure base role
                if (validRoleIds.length === 0) {
                    const baseRole = guild.roles.cache.get(mustHaveRoleId);
                    if (baseRole) validRoleIds.push(mustHaveRoleId);
                }

                await member.roles.set(validRoleIds);
                jailedPreviousRoles.delete(member.id);

                const reasonText = reason ? ` (${reason})` : '';
                await interaction.reply({ embeds: [buildStatusEmbed(`${interaction.user.tag} unjailed ${member.user.tag}${reasonText}.`, 'success')], ephemeral: false });
            } catch (err) {
                console.error('Error unjailing user:', err);
                try {
                    await interaction.reply({ embeds: [buildStatusEmbed('Unjail failed.', 'error')], ephemeral: true });
                } catch {}
            }
        }
    } catch (error) {
        console.error('Error in interactionCreate:', error);
        await interaction.reply({ embeds: [buildStatusEmbed('Error.', 'error')], ephemeral: true });
    }
});

// Button interactions for rules verify/decline
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    try {
        if (interaction.customId.startsWith('accept_rules:')) {
            const roleId = interaction.customId.split(':')[1];
            const verificationRole = interaction.guild.roles.cache.get(roleId);
            if (!verificationRole) {
                await interaction.reply({ embeds: [buildStatusEmbed('Verification role missing.', 'error')], ephemeral: true });
                return;
            }
            await interaction.member.roles.add(verificationRole);
            await interaction.reply({ embeds: [buildStatusEmbed('Verified', 'success')], ephemeral: true });
        }

        if (interaction.customId.startsWith('decline_rules:')) {
            const roleId = interaction.customId.split(':')[1];
            const verificationRole = interaction.guild.roles.cache.get(roleId);
            if (verificationRole && interaction.member.roles.cache.has(verificationRole.id)) {
                await interaction.member.roles.remove(verificationRole);
            }
            await interaction.reply({ embeds: [buildStatusEmbed('Unverified', 'info')], ephemeral: true });
        }
    } catch (err) {
        console.error('Button interaction error:', err);
        try { await interaction.reply({ embeds: [buildStatusEmbed('Error.', 'error')], ephemeral: true }); } catch {}
    }
});

// Message handler to capture the rules content and post with buttons
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const waitingData = waitingForRulesMessage.get(message.author.id);
    if (waitingData && waitingData.channelId === message.channelId) {
        waitingForRulesMessage.delete(message.author.id);

        const acceptButtonId = `accept_rules:${waitingData.roleId}`;
        const declineButtonId = `decline_rules:${waitingData.roleId}`;

        const acceptButton = new ButtonBuilder()
            .setCustomId(acceptButtonId)
            .setLabel('Accept / Verify')
            .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
            .setCustomId(declineButtonId)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

        try {
            try { await message.delete(); } catch {}
            await message.channel.send({ content: message.content, components: [row] });
            await message.author.send({ embeds: [buildStatusEmbed('Verification system is ready.', 'success')] }).catch(() => {});
        } catch (err) {
            console.error('Error posting rules message:', err);
            await message.channel.send({ content: 'Failed to post rules message.' }).catch(() => {});
        }
    }
});

// end of command handlers

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
