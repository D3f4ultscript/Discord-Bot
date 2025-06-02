// ==== START: Webserver für UptimeRobot ====
const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("✅ Bot läuft – bereit für UptimeRobot!");
});

app.listen(port, () => {
  console.log(`✅ Webserver aktiv unter Port ${port}`);
});
// ==== ENDE Webserver ====

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagBits } = require('discord.js');
require('dotenv').config();

// Create bot with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

// Überprüfe ob Token und Client ID vorhanden sind
if (!token || !clientId) {
    console.error('❌ Fehler: DISCORD_TOKEN oder CLIENT_ID fehlt in den Umgebungsvariablen!');
    process.exit(1);
}

// Define Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('script')
        .setDescription('Outputs the D3f4ult Hub Script'),
    new SlashCommandBuilder()
        .setName('chatclear')
        .setDescription('Deletes all messages in the channel (requires special role)'),
    new SlashCommandBuilder()
        .setName('info')
        .setDescription('Shows server info and script'),
    new SlashCommandBuilder()
        .setName('freewebh')
        .setDescription('Creates a webhook in the specified channel (requires special role)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select the channel for the webhook')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name for the webhook')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands and their descriptions'),
    new SlashCommandBuilder()
        .setName('createrole')
        .setDescription('Creates a role with predefined permissions (requires special role)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of role to create')
                .setRequired(true)
                .addChoices(
                    { name: '👑 Owner', value: 'owner' },
                    { name: '⚡ Admin', value: 'admin' },
                    { name: '🛡️ Moderator', value: 'moderator' },
                    { name: '🎮 VIP', value: 'vip' },
                    { name: '👤 Member', value: 'member' }
                ))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Custom name for the role (optional)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('Gives a role to a member (requires special role)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to give')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to give the role to')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Removes a role from a member (requires special role)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to remove the role from')
                .setRequired(true))
];

// Event when bot is ready
client.once('ready', async () => {
    console.log(`Bot is online as ${client.user.tag}!`);
    
    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('Starte Registrierung der Slash Commands...');
        
        // Registriere die Commands global
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ Erfolgreich ${data.length} Slash Commands registriert!`);
        console.log('Registrierte Commands:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('Fehler beim Registrieren der Commands:', error);
        // Zeige mehr Details über den Fehler
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
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'script') {
        const scriptCode = '```lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/D3f4ultscript/Scripts-for-D3f4ult-Hub/refs/heads/main/Hub.lua"))()\n```';
        await interaction.reply(`${interaction.user}\n${scriptCode}`);
    }
    
    if (interaction.commandName === 'info') {
        const scriptCode = '```lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/D3f4ultscript/Scripts-for-D3f4ult-Hub/refs/heads/main/Hub.lua"))()\n```';
        const serverInvite = 'https://discord.gg/2ynN9zcVFk';
        const ownerInfo = '**Server and Script Owner: D3f4ult**';
        
        await interaction.reply(`${interaction.user}\n\n${serverInvite}\n\n${scriptCode}\n\n${ownerInfo}`);
    }
    
    if (interaction.commandName === 'chatclear') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        
        // Check if user has any of the required roles
        const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        
        if (!hasRequiredRole) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles to clear the chat.', ephemeral: true });
            return;
        }
        
        // Create confirmation buttons
        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_clear')
            .setLabel('Yes, Clear Channel')
            .setStyle(ButtonStyle.Danger);
            
        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_clear')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);
            
        const row = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);
            
        await interaction.reply({
            content: '⚠️ Are you sure you want to delete ALL messages in this channel?',
            components: [row],
            ephemeral: true
        });
    }

    if (interaction.commandName === 'freewebh') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        
        // Check if user has any of the required roles
        const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        
        if (!hasRequiredRole) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles to create webhooks.', ephemeral: true });
            return;
        }

        const channel = interaction.options.getChannel('channel');
        const webhookName = interaction.options.getString('name');

        // Check if the channel is a text channel
        if (!channel.isTextBased()) {
            await interaction.reply({ 
                content: '❌ The selected channel must be a text channel!', 
                ephemeral: true 
            });
            return;
        }

        try {
            // Create the webhook
            const webhook = await channel.createWebhook({
                name: webhookName,
                avatar: client.user.displayAvatarURL(),
            });

            // Send message in the channel about webhook creation
            await channel.send({
                content: `🎉 **New Free Webhook Created**\nName: \`${webhookName}\`\nURL: ${webhook.url}\nCreated by: ${interaction.user}`,
                allowedMentions: { users: [] } // Prevents pinging the user who created it
            });

            // Send confirmation to the user
            await interaction.reply({ 
                content: `✅ Webhook created successfully!\nName: ${webhookName}\nChannel: ${channel}\nURL: ${webhook.url}`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error creating webhook:', error);
            await interaction.reply({ 
                content: '❌ Failed to create webhook! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.commandName === 'help') {
        const helpEmbed = {
            color: 0x0099FF,
            title: '📚 Available Commands',
            description: 'Here are all available commands:',
            fields: [
                {
                    name: '/help',
                    value: 'Shows this help message with all available commands',
                },
                {
                    name: '/script',
                    value: 'Outputs the D3f4ult Hub Script',
                },
                {
                    name: '/info',
                    value: 'Shows server information and the script',
                },
                {
                    name: '/chatclear',
                    value: '🔒 Deletes all messages in the channel\n*(Requires special role)*',
                },
                {
                    name: '/freewebh',
                    value: '🔒 Creates a webhook in the specified channel\n*(Requires special role)*',
                },
                {
                    name: '/createrole',
                    value: '🔒 Creates a role with predefined permissions\n*(Requires special role)*',
                },
                {
                    name: '/giverole',
                    value: '🔒 Gives a role to a member\n*(Requires special role)*',
                },
                {
                    name: '/removerole',
                    value: '🔒 Removes a role from a member\n*(Requires special role)*',
                }
            ],
            footer: {
                text: 'Commands marked with 🔒 require specific roles to use'
            },
            timestamp: new Date(),
        };

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (interaction.commandName === 'createrole') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        
        // Check if user has any of the required roles
        const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        
        if (!hasRequiredRole) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles to create roles.', ephemeral: true });
            return;
        }

        const roleType = interaction.options.getString('type');
        const customName = interaction.options.getString('name');

        // Define permission presets
        const rolePresets = {
            owner: {
                name: customName || '👑 Owner',
                color: '#FF0000',
                permissions: [
                    'Administrator'
                ],
                reason: 'Created owner role via command'
            },
            admin: {
                name: customName || '⚡ Admin',
                color: '#FFA500',
                permissions: [
                    'Administrator'
                ],
                reason: 'Created admin role via command'
            },
            moderator: {
                name: customName || '🛡️ Moderator',
                color: '#00FF00',
                permissions: [
                    'ViewAuditLog',
                    'ModerateMembers',
                    'KickMembers',
                    'ManageMessages',
                    'ManageThreads',
                    'ManageNicknames',
                    'MuteMembers',
                    'DeafenMembers',
                    'MoveMembers',
                    'ViewChannel',
                    'SendMessages',
                    'SendMessagesInThreads',
                    'CreatePublicThreads',
                    'CreatePrivateThreads',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'UseExternalStickers',
                    'MentionEveryone',
                    'ReadMessageHistory',
                    'UseApplicationCommands',
                    'Connect',
                    'Speak',
                    'Stream',
                    'UseVAD',
                    'PrioritySpeaker',
                    'RequestToSpeak'
                ],
                reason: 'Created moderator role via command'
            },
            vip: {
                name: customName || '🎮 VIP',
                color: '#FF69B4',
                permissions: [
                    'ViewChannel',
                    'SendMessages',
                    'SendMessagesInThreads',
                    'CreatePublicThreads',
                    'CreatePrivateThreads',
                    'SendVoiceMessages',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'UseExternalStickers',
                    'ReadMessageHistory',
                    'UseApplicationCommands',
                    'Connect',
                    'Speak',
                    'Stream',
                    'UseVAD',
                    'PrioritySpeaker',
                    'RequestToSpeak',
                    'UseSoundboard',
                    'UseEmbeddedActivities',
                    'ChangeNickname',
                    'CreateInstantInvite',
                    'UseExternalSounds'
                ],
                reason: 'Created VIP role via command'
            },
            member: {
                name: customName || '👤 Member',
                color: '#808080',
                permissions: [
                    'ViewChannel',
                    'SendMessages',
                    'SendMessagesInThreads',
                    'CreatePublicThreads',
                    'CreatePrivateThreads',
                    'SendVoiceMessages',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'UseExternalStickers',
                    'ReadMessageHistory',
                    'UseApplicationCommands',
                    'Connect',
                    'Speak',
                    'Stream',
                    'UseVAD',
                    'UseSoundboard',
                    'UseEmbeddedActivities',
                    'RequestToSpeak',
                    'CreateInstantInvite'
                ],
                reason: 'Created member role via command'
            }
        };

        try {
            const roleSettings = rolePresets[roleType];
            const newRole = await interaction.guild.roles.create({
                name: roleSettings.name,
                color: roleSettings.color,
                permissions: roleSettings.permissions,
                reason: roleSettings.reason
            });

            const roleEmbed = {
                color: roleSettings.color,
                title: '✅ Role Created Successfully',
                description: `New role ${newRole} has been created!`,
                fields: [
                    {
                        name: 'Role Type',
                        value: roleType.charAt(0).toUpperCase() + roleType.slice(1),
                        inline: true
                    },
                    {
                        name: 'Role Name',
                        value: roleSettings.name,
                        inline: true
                    }
                ],
                timestamp: new Date()
            };

            await interaction.reply({ embeds: [roleEmbed], ephemeral: true });
        } catch (error) {
            console.error('Error creating role:', error);
            await interaction.reply({ 
                content: '❌ Failed to create role! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.commandName === 'giverole') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        
        // Check if user has any of the required roles
        const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        
        if (!hasRequiredRole) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }

        const role = interaction.options.getRole('role');
        const member = interaction.options.getMember('member');

        // Check if role and member exist
        if (!role || !member) {
            await interaction.reply({ content: '❌ Role or member not found!', ephemeral: true });
            return;
        }

        try {
            // Add role to member
            await member.roles.add(role);
            
            // Send success message
            await interaction.reply({ 
                content: `✅ The role ${role} has been successfully given to ${member}!`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error giving role:', error);
            await interaction.reply({ 
                content: '❌ Failed to give role! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.commandName === 'removerole') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        
        // Check if user has any of the required roles
        const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        
        if (!hasRequiredRole) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }

        const role = interaction.options.getRole('role');
        const member = interaction.options.getMember('member');

        // Check if role and member exist
        if (!role || !member) {
            await interaction.reply({ content: '❌ Role or member not found!', ephemeral: true });
            return;
        }

        try {
            // Remove role from member
            await member.roles.remove(role);
            
            // Send success message
            await interaction.reply({ 
                content: `✅ The role ${role} has been successfully removed from ${member}!`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error removing role:', error);
            await interaction.reply({ 
                content: '❌ Failed to remove role! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }
});

// Event for Button Interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'confirm_clear') {
            const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
            
            // Check roles again
            const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
            
            if (!hasRequiredRole) {
                await interaction.update({ content: '❌ No permission! You need specific roles to clear the chat.', components: [] });
                return;
            }
            
            try {
                await interaction.update({ content: '🔄 Clearing channel...', components: [] });
                
                // Delete all messages
                let deleted;
                do {
                    deleted = await interaction.channel.bulkDelete(100, true);
                } while (deleted.size > 0);
                
                await interaction.followUp({ content: '✅ Channel has been successfully cleared!', ephemeral: true });
            } catch (error) {
                console.error('Error while deleting:', error);
                await interaction.followUp({ content: '❌ Error while deleting messages!', ephemeral: true });
            }
        }
        
        if (interaction.customId === 'cancel_clear') {
            await interaction.update({ content: 'Channel clearing cancelled.', components: [] });
        }
    }
});

// Login bot with token
client.login(token);
