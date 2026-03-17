#!/bin/bash

# OMMS Backend Quick Startup Script for Linux/Mac
# This script helps Frontend developers quickly start the backend services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_message "❌ Docker is not installed!" "$RED"
        print_message "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop" "$YELLOW"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_message "❌ Docker Compose is not installed!" "$RED"
        print_message "Please install Docker Compose from: https://docs.docker.com/compose/install/" "$YELLOW"
        exit 1
    fi
}

# Function to check if Docker daemon is running
check_docker_running() {
    if ! docker info &> /dev/null; then
        print_message "❌ Docker daemon is not running!" "$RED"
        print_message "Please start Docker Desktop and try again." "$YELLOW"
        exit 1
    fi
}

# Function to stop and remove existing containers
cleanup() {
    print_message "🧹 Cleaning up existing containers..." "$YELLOW"
    docker-compose down -v 2>/dev/null || docker compose down -v 2>/dev/null || true
}

# Function to start services
start_services() {
    print_message "🚀 Starting OMMS Backend services..." "$BLUE"
    
    # Try docker-compose first, then docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose up --build -d
    else
        docker compose up --build -d
    fi
}

# Function to show logs
show_logs() {
    print_message "📋 Showing logs (Press Ctrl+C to exit logs, services will continue running)..." "$BLUE"
    sleep 2
    
    if command -v docker-compose &> /dev/null; then
        docker-compose logs -f
    else
        docker compose logs -f
    fi
}

# Function to display service status
show_status() {
    print_message "\n📊 Service Status:" "$GREEN"
    docker ps --filter "name=omms" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Main script
main() {
    clear
    print_message "╔════════════════════════════════════════╗" "$BLUE"
    print_message "║   OMMS Backend Quick Startup Script   ║" "$BLUE"
    print_message "╚════════════════════════════════════════╝" "$BLUE"
    echo ""
    
    # Check prerequisites
    print_message "🔍 Checking prerequisites..." "$BLUE"
    check_docker
    check_docker_running
    print_message "✅ All prerequisites met!" "$GREEN"
    echo ""
    
    # Ask user if they want to clean up first
    read -p "Do you want to clean up existing containers? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup
    fi
    
    # Start services
    start_services
    
    # Wait a bit for services to initialize
    sleep 3
    
    # Show status
    show_status
    
    echo ""
    print_message "✅ OMMS Backend is starting up!" "$GREEN"
    print_message "🌐 Backend API will be available at: http://localhost:8080" "$GREEN"
    print_message "📚 API Documentation (Swagger): http://localhost:8080/api" "$GREEN"
    print_message "🗄️  Database: PostgreSQL on localhost:5432" "$GREEN"
    echo ""
    print_message "📝 Useful commands:" "$YELLOW"
    print_message "   - View logs: docker-compose logs -f" "$YELLOW"
    print_message "   - Stop services: docker-compose down" "$YELLOW"
    print_message "   - Restart services: docker-compose restart" "$YELLOW"
    echo ""
    
    # Ask if user wants to see logs
    read -p "Do you want to view the logs now? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        show_logs
    fi
}

# Run main function
main
