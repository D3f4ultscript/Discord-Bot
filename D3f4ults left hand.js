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

// Command usage statistics
let commandUsageCount = 0;

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
    
    // Check if the user has any of the required roles
    return member.roles.cache.some(role => allowedRoleIds.includes(role.id));
}

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
                .setDescription('The member to give the role to (or use "all" in the member field)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('all_members')
                .setDescription('Type "all" to give the role to all members (except bots)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Removes a role from a member (requires special role)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to remove the role from (or use "all" in the member field)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('all_members')
                .setDescription('Type "all" to remove the role from all members (except bots)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('infostats')
        .setDescription('Shows statistics about the bot'),
    new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Sets up a rules message with verification buttons (requires special role)')
        .addRoleOption(option =>
            option.setName('verification_role')
                .setDescription('The role to give when users accept the rules')
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

    // Increment command usage counter
    commandUsageCount++;

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
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
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

    if (interaction.commandName === 'help') {
        const helpEmbed = {
            color: 0x0099FF,
            title: '📚 Available Commands',
            description: 'Here are all available commands:',
            fields: [
                // Regular commands (available to everyone)
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
                    name: '/infostats',
                    value: 'Shows statistics about the bot',
                },
                // Restricted commands (require special role)
                {
                    name: '🔒 RESTRICTED COMMANDS',
                    value: 'The following commands require special roles to use:',
                },
                {
                    name: '/chatclear',
                    value: 'Deletes all messages in the channel',
                },
                {
                    name: '/createrole',
                    value: 'Creates a role with predefined permissions',
                },
                {
                    name: '/giverole',
                    value: 'Gives a role to a member',
                },
                {
                    name: '/removerole',
                    value: 'Removes a role from a member',
                },
                {
                    name: '/rules',
                    value: 'Sets up a rules message with verification buttons',
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
        if (!hasPermission(interaction.member)) {
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
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }

        const role = interaction.options.getRole('role');
        const member = interaction.options.getMember('member');
        const allMembersOption = interaction.options.getString('all_members');
        
        // Check if the "all" option is used
        if (allMembersOption === 'all' || (member && member.user.username === 'all')) {
            try {
                await interaction.deferReply({ ephemeral: true });
                
                // Get all members (this may require time for large servers)
                const members = await interaction.guild.members.fetch();
                let successCount = 0;
                let failCount = 0;
                
                // Create a progress message
                await interaction.editReply({ 
                    content: `⏳ Adding role ${role} to all members (except bots). This may take some time...`, 
                    ephemeral: true 
                });
                
                // Process members in batches to avoid rate limits
                for (const [id, guildMember] of members) {
                    // Skip bots
                    if (guildMember.user.bot) continue;
                    
                    try {
                        await guildMember.roles.add(role);
                        successCount++;
                        
                        // Update progress every 10 members
                        if (successCount % 10 === 0) {
                            await interaction.editReply({ 
                                content: `⏳ Progress: Added role to ${successCount} members so far...`, 
                                ephemeral: true 
                            });
                        }
                    } catch (error) {
                        console.error(`Error adding role to member ${guildMember.user.tag}:`, error);
                        failCount++;
                    }
                }
                
                // Send final success message
                await interaction.editReply({ 
                    content: `✅ Role ${role} has been added to ${successCount} members! ${failCount > 0 ? `Failed for ${failCount} members.` : ''}`, 
                    ephemeral: true 
                });
                return;
            } catch (error) {
                console.error('Error giving role to all members:', error);
                await interaction.editReply({ 
                    content: '❌ An error occurred while adding roles to all members.', 
                    ephemeral: true 
                });
                return;
            }
        }

        // Check if role and member exist for single member case
        if (!role || !member) {
            await interaction.reply({ 
                content: '❌ Role or member not found! Please specify either a valid member or use "all" in the all_members field.', 
                ephemeral: true 
            });
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
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }

        const role = interaction.options.getRole('role');
        const member = interaction.options.getMember('member');
        const allMembersOption = interaction.options.getString('all_members');
        
        // Check if the "all" option is used
        if (allMembersOption === 'all' || (member && member.user.username === 'all')) {
            try {
                await interaction.deferReply({ ephemeral: true });
                
                // Get all members (this may require time for large servers)
                const members = await interaction.guild.members.fetch();
                let successCount = 0;
                let failCount = 0;
                
                // Create a progress message
                await interaction.editReply({ 
                    content: `⏳ Removing role ${role} from all members (except bots). This may take some time...`, 
                    ephemeral: true 
                });
                
                // Process members in batches to avoid rate limits
                for (const [id, guildMember] of members) {
                    // Skip bots
                    if (guildMember.user.bot) continue;
                    
                    // Only remove if they have the role
                    if (guildMember.roles.cache.has(role.id)) {
                        try {
                            await guildMember.roles.remove(role);
                            successCount++;
                            
                            // Update progress every 10 members
                            if (successCount % 10 === 0) {
                                await interaction.editReply({ 
                                    content: `⏳ Progress: Removed role from ${successCount} members so far...`, 
                                    ephemeral: true 
                                });
                            }
                        } catch (error) {
                            console.error(`Error removing role from member ${guildMember.user.tag}:`, error);
                            failCount++;
                        }
                    }
                }
                
                // Send final success message
                await interaction.editReply({ 
                    content: `✅ Role ${role} has been removed from ${successCount} members! ${failCount > 0 ? `Failed for ${failCount} members.` : ''}`, 
                    ephemeral: true 
                });
                return;
            } catch (error) {
                console.error('Error removing role from all members:', error);
                await interaction.editReply({ 
                    content: '❌ An error occurred while removing roles from all members.', 
                    ephemeral: true 
                });
                return;
            }
        }

        // Check if role and member exist for single member case
        if (!role || !member) {
            await interaction.reply({ 
                content: '❌ Role or member not found! Please specify either a valid member or use "all" in the all_members field.', 
                ephemeral: true 
            });
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

    if (interaction.commandName === 'infostats') {
        // Count how many servers the bot is in
        const serverCount = client.guilds.cache.size;
        
        // Create an embed with bot statistics
        const statsEmbed = {
            color: 0x00FFFF,
            title: '📊 Bot Statistics',
            thumbnail: {
                url: client.user.displayAvatarURL({ dynamic: true })
            },
            fields: [
                {
                    name: '🌐 Servers',
                    value: `${serverCount}`,
                    inline: true
                },
                {
                    name: '⌨️ Commands Used',
                    value: `${commandUsageCount}`,
                    inline: true
                },
                {
                    name: '⏱️ Uptime',
                    value: formatUptime(client.uptime),
                    inline: true
                }
            ],
            footer: {
                text: `Bot ID: ${client.user.id}`
            },
            timestamp: new Date()
        };
        
        await interaction.reply({ embeds: [statsEmbed] });
    }

    if (interaction.commandName === 'rules') {
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
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
});

// Event for Button Interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'confirm_clear') {
            if (!hasPermission(interaction.member)) {
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

        // Handle rule acceptance
        if (interaction.customId.startsWith('accept_rules:')) {
            try {
                // Extract the role ID from the button custom ID
                const roleId = interaction.customId.split(':')[1];
                
                // Get the verification role
                const verificationRole = interaction.guild.roles.cache.get(roleId);
                
                if (!verificationRole) {
                    await interaction.reply({ content: '❌ Verification role not found! It may have been deleted.', ephemeral: true });
                    return;
                }
                
                // Add the role to the user
                await interaction.member.roles.add(verificationRole);
                
                // Send confirmation in the channel
                await interaction.reply({ content: `✅ You have been verified with the ${verificationRole.name} role! Thank you for accepting the rules.`, ephemeral: true });
                
                // Send DM to the user
                try {
                    await interaction.user.send({
                        content: `✅ You have been verified with the ${verificationRole.name} role! Thank you for accepting the rules.`,
                        embeds: [
                            {
                                color: 0x0099FF,
                                title: '✅ Verification Successful',
                                description: `You have been successfully verified with the ${verificationRole.name} role!`,
                                fields: [
                                    {
                                        name: 'Role',
                                        value: verificationRole.name,
                                        inline: true
                                    },
                                    {
                                        name: 'Verified by',
                                        value: interaction.user.tag,
                                        inline: true
                                    }
                                ],
                                timestamp: new Date()
                            }
                        ]
                    });
                } catch (error) {
                    console.error('Error sending DM:', error);
                    await interaction.reply({ content: '✅ Verification successful, but unable to send DM. Please check your DMs for confirmation.', ephemeral: true });
                }
            } catch (error) {
                console.error('Error accepting rules:', error);
                await interaction.reply({ content: '❌ An error occurred while accepting the rules. Please try again later.', ephemeral: true });
            }
        }
    }
});

// Event for rules message input
client.on('messageCreate', async message => {
    if (message.author.id === client.user.id && message.channel.id === waitingForRulesMessage.get(message.author.id)?.channelId) {
        const roleId = waitingForRulesMessage.get(message.author.id).roleId;
        const verificationRole = message.guild.roles.cache.get(roleId);
        
        if (verificationRole) {
            // Add the role to the user
            await message.member.roles.add(verificationRole);
            
            // Send confirmation in the channel
            await message.channel.send(`✅ You have been verified with the ${verificationRole.name} role! Thank you for accepting the rules.`);
            
            // Remove from waiting map
            waitingForRulesMessage.delete(message.author.id);
        }
    }
});

// Helper function to format uptime
function formatUptime(uptime) {
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime / 3600000) % 24;
    const minutes = Math.floor(uptime / 60000) % 60;
    const seconds = Math.floor(uptime / 1000) % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}