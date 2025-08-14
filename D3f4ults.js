const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const express = require("express");
require('dotenv').config();

// ==== START: Webserver für UptimeRobot ====
const app = express();
const PORT = process.env.PORT || 3001;

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

// Create bot with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],
});

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

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

// Define Slash Commands (only rules command)
const commands = [
    new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Sets up a rules message with verification buttons (requires special role)')
        .addRoleOption(option =>
            option.setName('verification_role')
                .setDescription('The role to give when users accept the rules')
                .setRequired(true))
];

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Event when bot is ready
client.once('ready', async () => {
    console.log(`\n=== BOT STARTUP ===`);
    console.log(`✅ Bot is online as ${client.user.tag}!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    console.log(`==================\n`);
    
    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('Registering Slash Commands...');
        
        // Register commands globally
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ Successfully registered ${data.length} slash commands!`);
        console.log('Registered commands:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Event for Slash Commands
client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isChatInputCommand()) return;

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
                timestamp: Date.now()
            });
            
            // Ask the user to provide the rules message
            await interaction.reply({ 
                content: `Please type your rules message now. Your next message in this channel will be used as the rules content with verification buttons.`,
                ephemeral: true 
            });
        }
    } catch (error) {
        console.error('Error in interactionCreate:', error);
        await interaction.reply({ content: '❌ An error occurred! Please contact an administrator.', ephemeral: true });
    }
});

// Event for Button Interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
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
                        content: `✅ **Verification Successful!**\n\nYou are now verified in **${interaction.guild.name}** with the ${verificationRole.name} role.\n\nBy accepting the rules, you agree to follow them at all times. Failure to comply may result in warnings or other penalties.\n\nIf you change your mind, you can use the decline button to remove your verification.`
                    });
                } catch (dmError) {
                    console.error('Could not send DM to user:', dmError);
                }
            } catch (error) {
                console.error('Error during verification:', error);
                await interaction.reply({ content: '❌ Failed to verify you! Please contact an administrator.', ephemeral: true });
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
                await interaction.reply({ content: '❌ You have declined the rules. Some features may be restricted.', ephemeral: true });
                
                // Send DM to the user
                try {
                    await interaction.user.send({
                        content: `❌ **Rules Declined**\n\nYou have declined the rules in **${interaction.guild.name}**.\n\nSome features and channels may be restricted. If you change your mind, you can verify again by accepting the rules.`
                    });
                } catch (dmError) {
                    console.error('Could not send DM to user:', dmError);
                }
            } catch (error) {
                console.error('Error during rule declination:', error);
                await interaction.reply({ content: '❌ An error occurred! Please contact an administrator.', ephemeral: true });
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
            .setLabel('✅ Accept Rules / Verify')
            .setStyle(ButtonStyle.Success);
            
        const declineButton = new ButtonBuilder()
            .setCustomId(declineButtonId)
            .setLabel('❌ Decline Rules')
            .setStyle(ButtonStyle.Danger);
            
        const row = new ActionRowBuilder()
            .addComponents(acceptButton, declineButton);
            
        try {
            // Delete the user's message if we can
            try {
                await message.delete();
            } catch (deleteError) {
                console.error('Could not delete user message:', deleteError);
            }
            
            // Send the rules message with buttons
            await message.channel.send({
                content: message.content,
                components: [row]
            });
            
            // Confirm to the user
            await message.author.send(`✅ Rules message has been posted in <#${message.channelId}> with verification buttons.`).catch(() => {});
        } catch (error) {
            console.error('Error posting rules message:', error);
            // Try to notify the user
            await message.channel.send({ 
                content: `❌ There was an error posting your rules message. Please try again.`,
                ephemeral: true 
            }).catch(() => {});
        }
    }
});

// Login bot with token
client.login(token);
